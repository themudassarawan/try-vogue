import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.config import STORAGE_DIR, SESSION_TTL_MINUTES

DB_FILE = STORAGE_DIR / "tryvogue_db.json"

DEFAULT_SIZE_CHART = {
    "S": {"chest_cm": 94.0, "waist_cm": 78.0},
    "M": {"chest_cm": 100.0, "waist_cm": 84.0},
    "L": {"chest_cm": 106.0, "waist_cm": 90.0},
    "XL": {"chest_cm": 112.0, "waist_cm": 96.0},
}

SEED_GARMENTS: List[Dict[str, Any]] = [
    {
        "garment_id": "kurt_001",
        "shop_id": "shop_default",
        "name": "Royal Embroidered Karandi Kurta",
        "category": "kurta",
        "image_url": "/static/catalog/kurt_001.png",
        "cutout_png_url": "/static/catalog/kurt_001.png",
        "available_sizes": ["S", "M", "L", "XL"],
        "size_chart": DEFAULT_SIZE_CHART,
        "dominant_colors": ["#1B365D", "#D4AF37"],
        "price": 5490.0,
    },
    {
        "garment_id": "kurt_002",
        "shop_id": "shop_default",
        "name": "Emerald Festivity Wash & Wear Kurta",
        "category": "kurta",
        "image_url": "/static/catalog/kurt_002.png",
        "cutout_png_url": "/static/catalog/kurt_002.png",
        "available_sizes": ["S", "M", "L", "XL"],
        "size_chart": DEFAULT_SIZE_CHART,
        "dominant_colors": ["#065F46", "#F5E6CC"],
        "price": 4250.0,
    },
    {
        "garment_id": "shirt_001",
        "shop_id": "shop_default",
        "name": "Oxford Slim Fit Charcoal Shirt",
        "category": "shirt",
        "image_url": "/static/catalog/shirt_001.png",
        "cutout_png_url": "/static/catalog/shirt_001.png",
        "available_sizes": ["S", "M", "L", "XL"],
        "size_chart": DEFAULT_SIZE_CHART,
        "dominant_colors": ["#374151", "#E2E8F0"],
        "price": 3290.0,
    },
    {
        "garment_id": "jacket_001",
        "shop_id": "shop_default",
        "name": "Classic Maroon Suede Bomber Jacket",
        "category": "jacket",
        "image_url": "/static/catalog/jacket_001.png",
        "cutout_png_url": "/static/catalog/jacket_001.png",
        "available_sizes": ["S", "M", "L", "XL"],
        "size_chart": DEFAULT_SIZE_CHART,
        "dominant_colors": ["#8B2635", "#1F2937"],
        "price": 7990.0,
    },
    {
        "garment_id": "acc_tie_001",
        "shop_id": "shop_default",
        "name": "Silk Burgundy Striped Necktie",
        "category": "accessory_tie",
        "image_url": "/static/catalog/acc_tie_001.png",
        "cutout_png_url": "/static/catalog/acc_tie_001.png",
        "available_sizes": ["S", "M", "L", "XL"],
        "size_chart": DEFAULT_SIZE_CHART,
        "dominant_colors": ["#9F1239", "#D4AF37"],
        "price": 1490.0,
    },
    {
        "garment_id": "acc_shawl_001",
        "shop_id": "shop_default",
        "name": "Traditional Swati Wool Pashmina Shawl",
        "category": "accessory_shawl",
        "image_url": "/static/catalog/acc_shawl_001.png",
        "cutout_png_url": "/static/catalog/acc_shawl_001.png",
        "available_sizes": ["S", "M", "L", "XL"],
        "size_chart": DEFAULT_SIZE_CHART,
        "dominant_colors": ["#C86D51", "#F5E6CC"],
        "price": 6500.0,
    },
]


class LocalStore:
    def __init__(self) -> None:
        self.data: Dict[str, Any] = {
            "users": {},
            "garments": {},
            "tryon_results": {},
            "favorites": [],
        }
        self._load()

    def _load(self) -> None:
        if DB_FILE.exists():
            try:
                self.data = json.loads(DB_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        if not self.data.get("garments"):
            for g in SEED_GARMENTS:
                self.data["garments"][g["garment_id"]] = g
            self.save()

    def save(self) -> None:
        DB_FILE.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def upsert_user(self, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES)).isoformat()
        existing = self.data["users"].get(user_id, {})
        existing.update(payload)
        existing["user_id"] = user_id
        existing["expires_at"] = expires_at
        self.data["users"][user_id] = existing
        self.save()
        return existing

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self.data["users"].get(user_id)

    def delete_user_session(self, user_id: str) -> None:
        self.data["users"].pop(user_id, None)
        self.save()


store = LocalStore()