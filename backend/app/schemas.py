from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Literal


class BiometricRequest(BaseModel):
    height_cm: float = Field(..., gt=100, lt=230, description="Height in centimeters")
    weight_kg: float = Field(..., gt=30, lt=200, description="Weight in kilograms")
    body_type: Literal["slim", "regular", "athletic", "heavy"] = "regular"
    fit_preference: Literal["slim", "regular", "loose"] = "regular"


class BiometricResponse(BaseModel):
    user_id: str
    bmi: float
    estimated_chest_cm: float
    estimated_waist_cm: float
    recommended_size: Literal["S", "M", "L", "XL"]
    confidence: float
    ease_ratio: float
    all_ease_ratios: Dict[str, float]


class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: float = 1.0


class GarmentItem(BaseModel):
    garment_id: str
    shop_id: str = "shop_default"
    name: str
    category: Literal["kurta", "shirt", "jacket", "pants", "accessory_tie", "accessory_shawl"]
    image_url: str
    cutout_png_url: str
    available_sizes: List[str] = ["S", "M", "L", "XL"]
    size_chart: Dict[str, Dict[str, float]]
    dominant_colors: List[str]
    price: float
    color_match_percent: Optional[int] = None


class TryOnRequest(BaseModel):
    user_id: str
    photo_id: str
    garment_id: str
    fit_size: Literal["S", "M", "L", "XL"] = "M"


class TryOnResponse(BaseModel):
    cache_key: str
    status: Literal["ready", "pending", "fallback"]
    mask_type: str
    before_url: str
    result_image_url: str
    latency_ms: float


class FavoriteRequest(BaseModel):
    user_id: str
    garment_id: str
    selected_size: Literal["S", "M", "L", "XL"]
    share_card_url: Optional[str] = None