from typing import Dict, Any

EASE_RATIOS: Dict[str, float] = {
    "S": 0.92,
    "M": 1.00,
    "L": 1.08,
    "XL": 1.16,
}

DEFAULT_SIZE_CHART: Dict[str, Dict[str, float]] = {
    "S": {"chest_cm": 94.0, "waist_cm": 78.0},
    "M": {"chest_cm": 100.0, "waist_cm": 84.0},
    "L": {"chest_cm": 106.0, "waist_cm": 90.0},
    "XL": {"chest_cm": 112.0, "waist_cm": 96.0},
}

BODY_TYPE_OFFSETS: Dict[str, Dict[str, float]] = {
    "slim": {"chest": -3.0, "waist": -3.5},
    "regular": {"chest": 0.0, "waist": 0.0},
    "athletic": {"chest": 2.5, "waist": -2.0},
    "heavy": {"chest": 4.5, "waist": 5.5},
}

FIT_PREF_OFFSETS: Dict[str, float] = {
    "slim": -2.0,
    "regular": 0.0,
    "loose": 4.0,
}


def calculate_biometric_size(
    height_cm: float,
    weight_kg: float,
    body_type: str = "regular",
    fit_preference: str = "regular",
    custom_size_chart: Dict[str, Dict[str, float]] | None = None,
) -> Dict[str, Any]:
    height_m = max(height_cm / 100.0, 1.2)
    bmi = round(weight_kg / (height_m ** 2), 2)

    body_key = body_type.lower().strip()
    fit_key = fit_preference.lower().strip()

    b_offset = BODY_TYPE_OFFSETS.get(body_key, BODY_TYPE_OFFSETS["regular"])
    f_offset = FIT_PREF_OFFSETS.get(fit_key, 0.0)

    # Anthropometric chest & waist estimation (cm)
    est_chest = (0.44 * height_cm) + (1.12 * bmi) - 4.5 + b_offset["chest"] + f_offset
    est_waist = (0.36 * height_cm) + (1.28 * bmi) - 11.0 + b_offset["waist"] + f_offset

    chart = custom_size_chart or DEFAULT_SIZE_CHART

    best_size = "M"
    min_distance = float("inf")

    for size_label, dims in chart.items():
        chest_diff = abs(est_chest - dims["chest_cm"])
        waist_diff = abs(est_waist - dims["waist_cm"])
        weighted_dist = (0.65 * chest_diff) + (0.35 * waist_diff)
        if weighted_dist < min_distance:
            min_distance = weighted_dist
            best_size = size_label

    raw_conf = 98.0 - (min_distance * 2.8)
    confidence = round(max(72.0, min(98.0, raw_conf)), 1)

    return {
        "bmi": bmi,
        "estimated_chest_cm": round(est_chest, 1),
        "estimated_waist_cm": round(est_waist, 1),
        "recommended_size": best_size,
        "confidence": confidence,
        "ease_ratio": EASE_RATIOS[best_size],
        "all_ease_ratios": EASE_RATIOS,
    }