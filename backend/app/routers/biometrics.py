import json
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas import BiometricRequest, BiometricResponse
from app.services.sizing_engine import calculate_biometric_size
from app.services.color_science import analyze_skin_undertone
from app.config import TEMP_SESSIONS_DIR
from app.database import store

router = APIRouter(prefix="/api/biometrics", tags=["Biometrics & Skin Tone (M1, M2, M3)"])


@router.post("/profile", response_model=BiometricResponse)
def create_biometric_profile(payload: BiometricRequest):
    user_id = f"usr_{uuid.uuid4().hex[:10]}"
    result = calculate_biometric_size(
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        body_type=payload.body_type,
        fit_preference=payload.fit_preference,
    )

    store.upsert_user(
        user_id,
        {
            "height": payload.height_cm,
            "weight": payload.weight_kg,
            "body_type": payload.body_type,
            "fit_preference": payload.fit_preference,
            "recommended_size": result["recommended_size"],
            "confidence": result["confidence"],
            "ease_ratio": result["ease_ratio"],
        },
    )

    return BiometricResponse(user_id=user_id, **result)


@router.post("/upload-photo")
async def upload_base_photo(
    user_id: str = Form(...),
    landmarks_json: str = Form("[]"),
    photo: UploadFile = File(...),
):
    user = store.get_user(user_id)
    if not user:
        # Auto-initialize default user session if photo is uploaded directly
        user = store.upsert_user(
            user_id,
            {
                "recommended_size": "M",
                "confidence": 85.0,
                "ease_ratio": 1.0,
            },
        )

    photo_id = f"ph_{uuid.uuid4().hex[:10]}"
    session_folder = TEMP_SESSIONS_DIR / photo_id
    session_folder.mkdir(parents=True, exist_ok=True)

    base_photo_path = session_folder / "user_base.jpg"
    with base_photo_path.open("wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)

    try:
        landmarks = json.loads(landmarks_json)
    except json.JSONDecodeError:
        landmarks = []

    # Save landmarks alongside photo for M6 mask generation
    landmarks_path = session_folder / "landmarks.json"
    landmarks_path.write_text(json.dumps(landmarks), encoding="utf-8")

    # Module M3: CIELAB / HSV / YCrCb skin undertone classification
    try:
        skin_info = analyze_skin_undertone(str(base_photo_path), landmarks)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Skin analysis failed: {exc}")

    store.upsert_user(
        user_id,
        {
            "photo_id": photo_id,
            "undertone": skin_info["undertone"],
            "lab_skin_tone": skin_info["lab_skin_tone"],
        },
    )

    return {
        "user_id": user_id,
        "photo_id": photo_id,
        "before_url": f"/static/sessions/{photo_id}/user_base.jpg",
        "undertone": skin_info["undertone"],
        "lab_skin_tone": skin_info["lab_skin_tone"],
        "warmth_index": skin_info["warmth_index"],
    }