import cv2
import numpy as np
from typing import List, Dict


def generate_novelty_mask(
    image_path: str,
    landmarks: List[Dict[str, float]],
    category: str,
    ease_ratio: float,
    output_mask_path: str,
) -> str:
    """
    Zero-Training Topology & Fit Mask Generator:
    - Western shirts/jackets -> extends to hip line (0.60H)
    - Pakistani kurtas -> extends to knee line (0.88H) with lateral hand protection
    - Scales horizontal mask width via S-XL ease_ratio (0.92x - 1.16x)
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Image not found: {image_path}")

    h, w, _ = img.shape
    mask = np.zeros((h, w), dtype=np.uint8)

    def pt(idx: int) -> tuple[int, int]:
        lm = landmarks[idx]
        return int(lm["x"] * w), int(lm["y"] * h)

    # MediaPipe Pose indices:
    # 11=left_shoulder, 12=right_shoulder, 13=left_elbow, 14=right_elbow,
    # 15=left_wrist, 16=right_wrist, 23=left_hip, 24=right_hip, 25=left_knee, 26=right_knee
    l_sh, r_sh = pt(11), pt(12)
    l_el, r_el = pt(13), pt(14)
    l_wr, r_wr = pt(15), pt(16)
    l_hip, r_hip = pt(23), pt(24)
    l_knee, r_knee = pt(25), pt(26)

    shoulder_width = max(abs(l_sh[0] - r_sh[0]), int(w * 0.14))
    pad_x = int(shoulder_width * 0.22)

    # Collar / neck top boundary
    y_top = max(0, min(l_sh[1], r_sh[1]) - int(shoulder_width * 0.18))

    cat = category.lower().strip()
    if cat == "kurta":
        # Extend bottom hem to knee landmarks (~0.88H) instead of clipping at pelvis (0.60H)
        y_bottom = min(h - 1, max(l_knee[1], r_knee[1]))
        hem_pad_x = int(pad_x * 1.10)  # Slight flare for knee-length kurta daman
    else:
        # Western shirt / jacket terminates at hip line (~0.60H)
        y_bottom = min(h - 1, max(l_hip[1], r_hip[1]) + int(shoulder_width * 0.12))
        hem_pad_x = pad_x

    # Torso polygon (ordered clockwise)
    torso_poly = np.array(
        [
            [max(0, r_sh[0] - pad_x), y_top],
            [min(w - 1, l_sh[0] + pad_x), y_top],
            [min(w - 1, l_hip[0] + hem_pad_x), y_bottom],
            [max(0, r_hip[0] - hem_pad_x), y_bottom],
        ],
        dtype=np.int32,
    )
    cv2.fillPoly(mask, [torso_poly], 255)

    # Draw full sleeves from shoulders -> elbows -> wrists
    sleeve_thickness = max(int(shoulder_width * 0.26), 24)
    cv2.line(mask, r_sh, r_el, 255, thickness=sleeve_thickness)
    cv2.line(mask, r_el, r_wr, 255, thickness=int(sleeve_thickness * 0.85))
    cv2.line(mask, l_sh, l_el, 255, thickness=sleeve_thickness)
    cv2.line(mask, l_el, l_wr, 255, thickness=int(sleeve_thickness * 0.85))

    # Apply S-XL Fit Slider morphological dilation or erosion (0.92x - 1.16x)
    delta_ratio = ease_ratio - 1.0
    if abs(delta_ratio) > 0.01:
        kernel_w = max(3, int(abs(delta_ratio) * shoulder_width * 0.65))
        if kernel_w % 2 == 0:
            kernel_w += 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_w, 5))
        if delta_ratio > 0:
            mask = cv2.dilate(mask, kernel, iterations=1)
        else:
            mask = cv2.erode(mask, kernel, iterations=1)

    # Lateral Hand Protection: carve out hand circles around wrists (15, 16) so hands stay crisp
    hand_radius = max(int(shoulder_width * 0.14), 18)
    cv2.circle(mask, r_wr, hand_radius, 0, -1)
    cv2.circle(mask, l_wr, hand_radius, 0, -1)

    cv2.imwrite(output_mask_path, mask)
    return output_mask_path