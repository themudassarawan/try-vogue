import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CATALOG_DIR, DEMO_CACHE_DIR, TEMP_SESSIONS_DIR
from app.database import store
from app.routers import biometrics, catalog, tryon


def purge_expired_sessions() -> None:
    """Add-On A1: Automatically deletes expired user photos and session try-on caches."""
    now = datetime.now(timezone.utc)
    expired_users = []

    for user_id, user_data in list(store.data["users"].items()):
        expires_str = user_data.get("expires_at")
        if not expires_str:
            continue
        try:
            expires_at = datetime.fromisoformat(expires_str)
            if now > expires_at:
                photo_id = user_data.get("photo_id")
                if photo_id:
                    session_dir = TEMP_SESSIONS_DIR / photo_id
                    if session_dir.exists():
                        shutil.rmtree(session_dir, ignore_errors=True)
                    keys_to_drop = [
                        k
                        for k, v in store.data["tryon_results"].items()
                        if photo_id in v.get("before_url", "")
                    ]
                    for k in keys_to_drop:
                        store.data["tryon_results"].pop(k, None)
                expired_users.append(user_id)
        except ValueError:
            continue

    for uid in expired_users:
        store.data["users"].pop(uid, None)

    if expired_users:
        store.save()
        print(f"[Add-On A1 TTL Cleanup] Purged {len(expired_users)} expired session(s).")


scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(purge_expired_sessions, "interval", minutes=5)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="TryVogue API",
    description="AI-Powered Fashion Discovery and Virtual Try-On Platform (M1–M7 + A1–A4)",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow Next.js frontend and HTTPS mobile tunnels
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directories for catalog cutouts, demo cache, and ephemeral session results
app.mount("/static/catalog", StaticFiles(directory=str(CATALOG_DIR)), name="catalog_static")
app.mount("/static/demo", StaticFiles(directory=str(DEMO_CACHE_DIR)), name="demo_static")
app.mount("/static/sessions", StaticFiles(directory=str(TEMP_SESSIONS_DIR)), name="sessions_static")

# Register API routers
app.include_router(biometrics.router)
app.include_router(catalog.router)
app.include_router(tryon.router)


@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "TryVogue FastAPI Backend",
        "modules": ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "A1", "A2", "A3", "A4"],
    }