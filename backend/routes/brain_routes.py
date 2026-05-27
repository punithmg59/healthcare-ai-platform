"""
Brain Tumor MRI API Routes.
Handles upload, prediction, and history endpoints.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from services.brain_service import process_brain_mri
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/brain", tags=["Brain Tumor MRI"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".dcm"}


@router.post("/predict")
async def predict_brain_tumor(file: UploadFile = File(...)):
    """
    Production Endpoint: Upload Brain MRI for AI Tumor Classification.
    Accepts: JPG, JPEG, PNG, BMP, TIFF, DICOM
    Returns: Prediction, confidence, risk level, and medical report.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    import os
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Use: JPG, JPEG, PNG, BMP, TIFF, or DICOM."
        )

    try:
        logger.info(f"[BRAIN ROUTE] POST /api/brain/predict - File: {file.filename}")
        result = await process_brain_mri(file)
        return result
    except RuntimeError as re:
        logger.error(f"[BRAIN ROUTE] Model error: {str(re)}")
        raise HTTPException(status_code=503, detail=f"Model not available: {str(re)}")
    except ValueError as ve:
        logger.error(f"[BRAIN ROUTE] Validation error: {str(ve)}")
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(ve)}")
    except Exception as e:
        logger.error(f"[BRAIN ROUTE] Endpoint error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Brain Tumor AI Pipeline Error: {str(e)}"
        )


@router.get("/history")
async def get_brain_history():
    """Fetch all brain tumor analysis history."""
    from database.database import SessionLocal
    from database.db_models import BrainTumorPrediction

    db = SessionLocal()
    try:
        records = db.query(BrainTumorPrediction).order_by(BrainTumorPrediction.created_at.desc()).all()
        return records
    except Exception as e:
        logger.error(f"[BRAIN ROUTE] History error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        db.close()


@router.get("/report/{report_id}")
async def get_brain_report(report_id: int):
    """Fetch a single brain tumor report by ID."""
    from database.database import SessionLocal
    from database.db_models import BrainTumorPrediction

    db = SessionLocal()
    try:
        record = db.query(BrainTumorPrediction).filter(BrainTumorPrediction.id == report_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Report not found")
        return record
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[BRAIN ROUTE] Report fetch error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        db.close()


@router.get("/health")
def brain_health_check():
    """Health check for brain tumor module."""
    from services.brain_service import get_predictor
    # Check if the model is currently initialized without loading it
    from services.brain_service import _predictor
    return {
        "status": "ok",
        "module": "Brain Tumor MRI AI Core",
        "model_loaded": _predictor is not None
    }
