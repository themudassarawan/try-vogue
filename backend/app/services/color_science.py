import cv2
import numpy as np
from typing import Dict, List, Any


def hex_to_lab(hex_color: str) -> np.ndarray:
    hex_clean = hex_color.lstrip("#")
    r, g, b = tuple(int(hex_clean[i : i + 2], 16) for i in (0, 2, 4))
    bgr = np.uint8([[[b, g, r]]])
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[0][0].astype(np.float32)
    return lab


def analyze_skin_undertone(
    image_path: str, landmarks: List[Dict[str, float]] | None = None
) -> Dict[str, Any]:
    """
    Samples cheek and forehead skin pixels in CIELAB, HSV, and YCrCb space
    to classify Warm, Cool, or Neutral undertone and extract true skin L*a*b*.
    """
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise ValueError(f"Could not read image at {image_path}")

    h, w, _ = img_bgr.shape

    # Locate facial ROI via MediaPipe nose landmark (index 0) if provided, else upper-center fallback
    if landmarks and len(landmarks) > 10:
        nose = landmarks[0]
        cx, cy = int(nose["x"] * w), int(nose["y"] * h)
        box_r = max(int(w * 0.05), 16)
        x1, y1 = max(0, cx - box_r), max(0, cy - box_r)
        x2, y2 = min(w, cx + box_r), min(h, cy + box_r)
        roi_bgr = img_bgr[y1:y2, x1:x2]
    else:
        roi_bgr = img_bgr[int(h * 0.12) : int(h * 0.26), int(w * 0.42) : int(w * 0.58)]

    if roi_bgr.size == 0:
        roi_bgr = img_bgr[int(h * 0.15) : int(h * 0.25), int(w * 0.45) : int(w * 0.55)]

    # YCrCb skin pixel filter to isolate pure skin from hair/glasses/background
    ycrcb = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2YCrCb)
    skin_mask = cv2.inRange(ycrcb, np.array([0, 133, 77]), np.array([255, 173, 127]))

    lab_roi = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2LAB)
    hsv_roi = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)

    if cv2.countNonZero(skin_mask) > 25:
        skin_lab = lab_roi[skin_mask > 0]
        skin_hsv = hsv_roi[skin_mask > 0]
    else:
        skin_lab = lab_roi.reshape(-1, 3)
        skin_hsv = hsv_roi.reshape(-1, 3)

    median_lab = np.median(skin_lab, axis=0).astype(float)
    median_hsv = np.median(skin_hsv, axis=0).astype(float)

    # OpenCV LAB: L in [0,255], a in [0,255] (128=neutral), b in [0,255] (128=neutral)
    a_centered = median_lab[1] - 128.0
    b_centered = median_lab[2] - 128.0
    warmth_index = b_centered - (0.85 * a_centered)

    if warmth_index > 4.5:
        undertone = "Warm"
    elif warmth_index < 1.0:
        undertone = "Cool"
    else:
        undertone = "Neutral"

    return {
        "undertone": undertone,
        "lab_skin_tone": [round(float(x), 2) for x in median_lab],
        "hsv_median": [round(float(x), 2) for x in median_hsv],
        "warmth_index": round(float(warmth_index), 2),
    }


def compute_color_harmony_score(undertone: str, garment_hex_colors: List[str]) -> int:
    """
    Computes a Color-Harmony Match % badge (72% - 99%) comparing garment dominant
    colors against undertone-aligned CIELAB target palettes via Delta-E distance.
    """
    if not garment_hex_colors:
        return 85

    harmony_anchors = {
        "Warm": ["#8B2635", "#D4AF37", "#2E5A44", "#C86D51", "#F5E6CC", "#1B365D"],
        "Cool": ["#1E3A8A", "#4A0E4E", "#0F766E", "#64748B", "#E2E8F0", "#9F1239"],
        "Neutral": ["#1F2937", "#374151", "#065F46", "#7C2D12", "#F3F4F6", "#1D4ED8"],
    }

    target_labs = [hex_to_lab(h) for h in harmony_anchors.get(undertone, harmony_anchors["Neutral"])]
    garment_labs = [hex_to_lab(h) for h in garment_hex_colors]

    min_delta_e = float("inf")
    for g_lab in garment_labs:
        for t_lab in target_labs:
            de = np.sqrt(
                0.35 * ((g_lab[0] - t_lab[0]) ** 2)
                + 1.0 * ((g_lab[1] - t_lab[1]) ** 2)
                + 1.0 * ((g_lab[2] - t_lab[2]) ** 2)
            )
            if de < min_delta_e:
                min_delta_e = de

    score = int(round(max(72.0, min(99.0, 99.0 - (min_delta_e * 0.24)))))
    return score


def apply_cielab_skin_lock(
    original_img_path: str,
    vton_output_path: str,
    mask_path: str,
    target_lab_skin: List[float],
    final_output_path: str,
) -> str:
    """
    Deterministic post-VTON CIELAB skin-tone lock:
    1. Restores all non-masked pixels (face, hair, background) directly from original photo.
    2. Locks exposed neck/arm skin inside the synthesized mask to the user's true facial L*a*b*.
    """
    orig = cv2.imread(original_img_path)
    vton = cv2.imread(vton_output_path)
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)

    h, w, _ = orig.shape
    vton = cv2.resize(vton, (w, h), interpolation=cv2.INTER_LANCZOS4)
    mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)

    vton_ycrcb = cv2.cvtColor(vton, cv2.COLOR_BGR2YCrCb)
    vton_skin = cv2.inRange(vton_ycrcb, np.array([0, 133, 77]), np.array([255, 173, 127]))
    exposed_mask_skin = cv2.bitwise_and(vton_skin, mask)

    vton_lab = cv2.cvtColor(vton, cv2.COLOR_BGR2LAB).astype(np.float32)

    if cv2.countNonZero(exposed_mask_skin) > 30:
        skin_pixels = vton_lab[exposed_mask_skin > 0]
        current_median = np.median(skin_pixels, axis=0)
        target_arr = np.array(target_lab_skin, dtype=np.float32)

        delta = target_arr - current_median
        for c in range(3):
            channel = vton_lab[:, :, c]
            channel[exposed_mask_skin > 0] = np.clip(
                channel[exposed_mask_skin > 0] + delta[c], 0, 255
            )
            vton_lab[:, :, c] = channel

    locked_bgr = cv2.cvtColor(vton_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)

    soft_mask = cv2.GaussianBlur(mask, (7, 7), 0).astype(np.float32) / 255.0
    soft_mask_3c = np.repeat(soft_mask[:, :, np.newaxis], 3, axis=2)

    composited = (locked_bgr.astype(np.float32) * soft_mask_3c) + (
        orig.astype(np.float32) * (1.0 - soft_mask_3c)
    )
    cv2.imwrite(final_output_path, composited.astype(np.uint8))
    return final_output_path