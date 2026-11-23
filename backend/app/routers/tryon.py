import hashlib
import json
import shutil
import time
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.schemas import TryOnRequest, TryOnResponse, FavoriteRequest
from app.config import TEMP_SESSIONS_DIR, CATALOG_DIR
from app.database import store
from app.services.sizing_engine import EASE_RATIOS
from app.services.mask_generator import generate_novelty_mask
from app.services.vton_client import run_cloud_vton
from app.services.color_science import (
    apply_cielab_skin_lock,
    compute_color_harmony_score,
)

router = APIRouter(prefix="/api/tryon", tags=["Cloud HD Try-On, Pre-Fetch & Add-Ons (M6, A1, A3)"])


def _make_cache_key(photo_id: str, garment_id: str, fit_size: str) -> str:
    raw = f"{photo_id}:{garment_id}:{fit_size}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def _execute_single_tryon(
    user_id: str, photo_id: str, garment_id: str, fit_size: str
) -> dict:
    cache_key = _make_cache_key(photo_id, garment_id, fit_size)
    if cache_key in store.data["tryon_results"]:
        cached = store.data["tryon_results"][cache_key]
        if cached.get("status") in ("ready", "fallback"):
            return cached

    session_folder = TEMP_SESSIONS_DIR / photo_id
    base_photo = session_folder / "user_base.jpg"
    landmarks_file = session_folder / "landmarks.json"

    if not base_photo.exists():
        raise FileNotFoundError("Session base photo expired or not found")

    garment = store.data["garments"].get(garment_id)
    if not garment:
        raise KeyError(f"Garment {garment_id} not found")

    garment_filename = garment["cutout_png_url"].split("/")[-1]
    garment_path = CATALOG_DIR / garment_filename

    landmarks = (
        json.loads(landmarks_file.read_text(encoding="utf-8"))
        if landmarks_file.exists()
        else []
    )
    ease_ratio = EASE_RATIOS.get(fit_size, 1.0)
    category = garment.get("category", "shirt")
    mask_type = "knee_0.88H" if category == "kurta" else "hip_0.60H"

    mask_path = session_folder / f"mask_{cache_key}.png"
    raw_vton_path = session_folder / f"raw_{cache_key}.jpg"
    final_output_path = session_folder / f"result_{cache_key}.jpg"

    # Step 1: Generate Kurta (0.88H) / Shirt (0.60H) + S-XL Fit morphological mask
    if landmarks and len(landmarks) >= 27:
        generate_novelty_mask(
            image_path=str(base_photo),
            landmarks=landmarks,
            category=category,
            ease_ratio=ease_ratio,
            output_mask_path=str(mask_path),
        )
    else:
        # Fallback full-torso mask if photo was uploaded without 33 landmarks
        shutil.copyfile(base_photo, mask_path)

    # Step 2: Run Mode B Cloud Diffusion (is_checked=False) or Demo Cache fallback
    _, status_label = run_cloud_vton(
        person_img_path=str(base_photo),
        garment_img_path=str(garment_path) if garment_path.exists() else str(base_photo),
        custom_mask_path=str(mask_path),
        garment_description=f"{garment['name']} ({category}, size {fit_size})",
        garment_id=garment_id,
        fit_size=fit_size,
        raw_output_path=str(raw_vton_path),
    )

    # Step 3: Deterministic CIELAB Complexion Lock (prevents South Asian skin lightening)
    user = store.get_user(user_id) or {}
    target_lab = user.get("lab_skin_tone", [165.0, 134.0, 142.0])

    if landmarks and len(landmarks) >= 27 and status_label == "ready":
        apply_cielab_skin_lock(
            original_img_path=str(base_photo),
            vton_output_path=str(raw_vton_path),
            mask_path=str(mask_path),
            target_lab_skin=target_lab,
            final_output_path=str(final_output_path),
        )
    else:
        shutil.copyfile(raw_vton_path, final_output_path)

    record = {
        "cache_key": cache_key,
        "status": status_label,
        "mask_type": mask_type,
        "before_url": f"/static/sessions/{photo_id}/user_base.jpg",
        "result_image_url": f"/static/sessions/{photo_id}/result_{cache_key}.jpg",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    store.data["tryon_results"][cache_key] = record
    store.save()
    return record


@router.post("/generate", response_model=TryOnResponse)
def generate_hd_tryon(payload: TryOnRequest):
    t0 = time.perf_counter()
    try:
        record = _execute_single_tryon(
            user_id=payload.user_id,
            photo_id=payload.photo_id,
            garment_id=payload.garment_id,
            fit_size=payload.fit_size,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return TryOnResponse(**record, latency_ms=latency_ms)


def _background_prefetch_worker(user_id: str, photo_id: str, fit_size: str) -> None:
    user = store.get_user(user_id) or {}
    undertone = user.get("undertone", "Neutral")

    # Rank wearable garments (kurtas, shirts, jackets) by CIELAB Color-Harmony %
    candidates = [
        g
        for g in store.data["garments"].values()
        if g.get("category") in ("kurta", "shirt", "jacket")
    ]
    candidates.sort(
        key=lambda g: compute_color_harmony_score(undertone, g.get("dominant_colors", [])),
        reverse=True,
    )

    # Speculatively pre-generate Top 2 highest color-matched outfits
    for top_garment in candidates[:2]:
        try:
            _execute_single_tryon(
                user_id=user_id,
                photo_id=photo_id,
                garment_id=top_garment["garment_id"],
                fit_size=fit_size,
            )
        except Exception as exc:
            print(f"[Pre-Fetch Warning] {top_garment['garment_id']}: {exc}")


@router.post("/prefetch")
def trigger_top2_prefetch(
    user_id: str,
    photo_id: str,
    fit_size: str = "M",
    background_tasks: BackgroundTasks = None,
):
    background_tasks.add_task(_background_prefetch_worker, user_id, photo_id, fit_size)
    return {
        "queued": True,
        "message": "Top-2 Color-Harmony outfits queued for background HD pre-fetching",
    }


@router.delete("/session/{user_id}/{photo_id}")
def clear_user_session_data(user_id: str, photo_id: str):
    """Add-On A1: 1-click immediate deletion of user photos and try-on cache."""
    session_folder = TEMP_SESSIONS_DIR / photo_id
    if session_folder.exists():
        shutil.rmtree(session_folder, ignore_errors=True)

    # Purge cached records linked to this photo_id
    keys_to_remove = [
        k
        for k, v in store.data["tryon_results"].items()
        if photo_id in v.get("before_url", "")
    ]
    for k in keys_to_remove:
        store.data["tryon_results"].pop(k, None)

    store.delete_user_session(user_id)
    return {"deleted": True, "photo_id": photo_id, "message": "All session photos purged"}


@router.post("/favorites")
def save_favorite_outfit(payload: FavoriteRequest):
    """Add-On A3: Bookmark favorite outfit & share card."""
    entry = {
        "user_id": payload.user_id,
        "garment_id": payload.garment_id,
        "selected_size": payload.selected_size,
        "share_card_url": payload.share_card_url,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    store.data["favorites"].append(entry)
    store.save()
    return {"saved": True, "favorite": entry}


@router.get("/favorites/{user_id}")
def get_user_favorites(user_id: str):
    favs = [f for f in store.data["favorites"] if f["user_id"] == user_id]
    return {"count": len(favs), "favorites": favs}