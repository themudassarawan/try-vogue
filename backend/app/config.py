import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
CATALOG_DIR = STORAGE_DIR / "catalog_pngs"
DEMO_CACHE_DIR = STORAGE_DIR / "demo_cache"
TEMP_SESSIONS_DIR = STORAGE_DIR / "temp_sessions"

# Ensure directories exist at startup
for folder in (CATALOG_DIR, DEMO_CACHE_DIR, TEMP_SESSIONS_DIR):
    folder.mkdir(parents=True, exist_ok=True)

# Add-On A1: Default session Time-To-Live (in minutes) before auto-deleting user photos
SESSION_TTL_MINUTES = int(os.getenv("SESSION_TTL_MINUTES", "30"))

# Cloud VTON Space (Hugging Face ZeroGPU IDM-VTON / CatVTON)
HF_VTON_SPACE = os.getenv("HF_VTON_SPACE", "yisol/IDM-VTON")
HF_TOKEN = os.getenv("HF_TOKEN", "")

# Admin Panel M7 credentials (change in production .env)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "tryvogue2026")