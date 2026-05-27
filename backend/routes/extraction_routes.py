from fastapi import APIRouter, HTTPException, UploadFile, File
import logging
from services.ocr_service import process_report_for_extraction
from database.database import SessionLocal
import json
import uuid
from datetime import datetime
from database.db_models import ExtractedDocument

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/extraction", tags=["Medical OCR Extraction"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

@router.post("/auto-fill")
async def extract_auto_fill_data(file: UploadFile = File(...)):
    """
    Uploads a medical document and extracts text and values for frontend auto-fill.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    import os
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Use: PDF, JPG, JPEG, or PNG."
        )

    logger.info(f"[EXTRACTION] Processing file: {file.filename}")
    
    # Save the file permanently
    os.makedirs("uploads/ocr", exist_ok=True)
    file_path = os.path.join("uploads/ocr", f"{uuid.uuid4().hex}_{file.filename}")
    
    file_bytes = await file.read()
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    # Reset file pointer or just pass bytes to service?
    # Since process_report_for_extraction expects UploadFile and reads it,
    # we need to seek(0)
    await file.seek(0)
    
    result = await process_report_for_extraction(file)
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Extraction failed"))

    # Save to database
    db = SessionLocal()
    try:
        # Create a new ExtractedDocument record
        new_doc = ExtractedDocument(
            filename=file.filename,
            filepath=file_path,
            extracted_text=result["raw_text"],
            extracted_data_json=json.dumps(result["extracted_data"])
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
        logger.info(f"[EXTRACTION] Saved to DB with ID: {new_doc.id}")
    except Exception as e:
        logger.error(f"[EXTRACTION] Database save failed: {e}")
        db.rollback()
    finally:
        db.close()

    return {
        "success": True,
        "extracted_data": result["extracted_data"]
    }
