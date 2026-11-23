import uuid
import shutil
import cv2
import numpy as np
from sklearn.cluster import KMeans
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
from app.config import CATALOG_DIR, ADMIN_USERNAME, ADMIN_PASSWORD
from app.database import store, DEFAULT_SIZE_CHART
from app.services.color_science import compute_color_harmony_score

router = APIRouter(prefix="/api/catalog", tags=["Catalog & Admin Panel (M4, M7)"])


def extract_dominant_hex_colors(image_path: str, k: int = 2) -> List[str]:
    """Extracts top dominant hex colors from non-transparent pixels of a cutout PNG."""
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        return ["#1F2937"]

    if img.shape[2] == 4:
        alpha = img[:, :, 3]
        rgb = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2RGB)
        pixels = rgb[alpha > 128]
    else:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pixels = rgb.reshape(-1, 3)

    if len(pixels) < 10:
        return ["#1F2937"]

    # Downsample for fast K-Means on CPU
    if len(pixels) > 3000:
        idx = np.random.choice(len(pixels), 3000, replace=False)
        pixels = pixels[idx]

    kmeans = KMeans(n_clusters=k, n_init=5, random_state=42)
    kmeans.fit(pixels)
    centers = kmeans.cluster_centers_.astype(int)
    return [f"#{r:02X}{g:02X}{b:02X}" for r, g, b in centers]


@router.get("")
def list_catalog(
    category: Optional[str] = None,
    size: Optional[str] = None,
    q: Optional[str] = None,
    user_id: Optional[str] = None,
):
    items = list(store.data["garments"].values())

    if category and category.lower() != "all":
        items = [g for g in items if g["category"].lower() == category.lower()]

    if size and size.upper() != "ALL":
        items = [g for g in items if size.upper() in g.get("available_sizes", [])]

    if q:
        query = q.lower().strip()
        items = [
            g
            for g in items
            if query in g["name"].lower() or query in g["category"].lower()
        ]

    undertone = None
    if user_id:
        user = store.get_user(user_id)
        if user:
            undertone = user.get("undertone")

    enriched = []
    for item in items:
        copy_item = dict(item)
        if undertone:
            copy_item["color_match_percent"] = compute_color_harmony_score(
                undertone, copy_item.get("dominant_colors", [])
            )
        enriched.append(copy_item)

    if undertone:
        enriched.sort(key=lambda x: x.get("color_match_percent", 0), reverse=True)

    return {"count": len(enriched), "items": enriched}


@router.post("/admin/login")
def admin_login(username: str = Form(...), password: str = Form(...)):
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        return {"authenticated": True, "token": "tryvogue_admin_session_token"}
    raise HTTPException(status_code=401, detail="Invalid admin credentials")


@router.post("/admin/upload")
async def admin_upload_garment(
    name: str = Form(...),
    category: str = Form(...),
    price: float = Form(...),
    available_sizes: str = Form("S,M,L,XL"),
    cutout_png: UploadFile = File(...),
):
    garment_id = f"{category[:4].lower()}_{uuid.uuid4().hex[:6]}"
    filename = f"{garment_id}.png"
    save_path = CATALOG_DIR / filename

    with save_path.open("wb") as buffer:
        shutil.copyfileobj(cutout_png.file, buffer)

    dominant_colors = extract_dominant_hex_colors(str(save_path), k=2)
    sizes_list = [s.strip().upper() for s in available_sizes.split(",") if s.strip()]

    new_garment = {
        "garment_id": garment_id,
        "shop_id": "shop_default",
        "name": name,
        "category": category.lower().strip(),
        "image_url": f"/static/catalog/{filename}",
        "cutout_png_url": f"/static/catalog/{filename}",
        "available_sizes": sizes_list,
        "size_chart": DEFAULT_SIZE_CHART,
        "dominant_colors": dominant_colors,
        "price": price,
    }

    store.data["garments"][garment_id] = new_garment
    store.save()
    return {"message": "Garment uploaded successfully", "garment": new_garment}


@router.delete("/admin/{garment_id}")
def admin_delete_garment(garment_id: str):
    if garment_id not in store.data["garments"]:
        raise HTTPException(status_code=404, detail="Garment not found")
    store.data["garments"].pop(garment_id, None)
    store.save()
    return {"deleted": True, "garment_id": garment_id}