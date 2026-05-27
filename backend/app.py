import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Ensure the backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routes.heart_routes import router as heart_router
from routes.history_routes import router as history_router
from routes.analytics_routes import router as analytics_router
from routes.xray_routes import router as xray_router
from routes.brain_routes import router as brain_router
from routes.translation_routes import router as translation_router
from routes.extraction_routes import router as extraction_router

app = FastAPI(
    title="Healthcare AI API",
    version="2.0.0"
)

# Mount Static Files for images/heatmaps
import os
os.makedirs("uploads/mri", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTES
# =========================

app.include_router(heart_router)
app.include_router(history_router)
app.include_router(analytics_router)
app.include_router(xray_router)
app.include_router(brain_router)
app.include_router(translation_router)
app.include_router(extraction_router)


# =========================
# ROOT
# =========================

@app.get("/")
def home():
    return {
        "message": "Healthcare AI Backend Running",
        "version": "2.0.0"
    }