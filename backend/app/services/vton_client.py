import shutil
from pathlib import Path
from typing import Tuple
from PIL import Image
from gradio_client import Client, handle_file
from app.config import HF_VTON_SPACE, HF_TOKEN, DEMO_CACHE_DIR


def run_cloud_vton(
    person_img_path: str,
    garment_img_path: str,
    custom_mask_path: str,
    garment_description: str,
    garment_id: str,
    fit_size: str,
    raw_output_path: str,
) -> Tuple[str, str]:
    """
    Executes Mode B Cloud HD Try-On via gradio_client with is_checked=False
    so IDM-VTON / CatVTON respects TryVogue's custom Kurta (0.88H) & S-XL mask.
    Falls back cleanly to demo_cache if free cloud GPU queue is busy or offline.
    Returns: (output_image_path, status_label)
    """
    try:
        client = Client(HF_VTON_SPACE, hf_token=HF_TOKEN or None)

        # IDM-VTON Gradio endpoint signature:
        # dict={"background": person_img, "layers": [mask_img], "composite": None}
        # is_checked=False disables default Western waist-clipping auto-mask
        result = client.predict(
            dict={
                "background": handle_file(person_img_path),
                "layers": [handle_file(custom_mask_path)],
                "composite": None,
            },
            garm_img=handle_file(garment_img_path),
            garment_des=garment_description,
            is_checked=False,
            is_checked_crop=False,
            denoise_steps=30,
            seed=42,
            api_name="/tryon",
        )

        # gradio_client returns a tuple (output_img_path, masked_img_path)
        generated_path = result[0] if isinstance(result, (list, tuple)) else result
        shutil.copyfile(generated_path, raw_output_path)
        return raw_output_path, "ready"

    except Exception as exc:
        print(f"[VTON Fallback Triggered] Cloud GPU unavailable or busy: {exc}")

        # 1. Check pre-generated demo cache for this garment + size
        demo_candidate = DEMO_CACHE_DIR / f"{garment_id}_{fit_size}.jpg"
        if not demo_candidate.exists():
            demo_candidate = DEMO_CACHE_DIR / f"{garment_id}.jpg"

        if demo_candidate.exists():
            shutil.copyfile(demo_candidate, raw_output_path)
            return raw_output_path, "fallback"

        # 2. Safe offline fallback: copy original photo so pipeline never crashes
        img = Image.open(person_img_path).convert("RGB")
        img.save(raw_output_path, format="JPEG", quality=92)
        return raw_output_path, "fallback"