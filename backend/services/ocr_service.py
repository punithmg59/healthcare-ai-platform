import os
import re
import uuid
import logging
from fastapi import UploadFile

logger = logging.getLogger(__name__)

# Lazy loading of PaddleOCR to avoid massive startup overhead
_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        try:
            logger.info("⏳ Loading PaddleOCR engine...")
            from paddleocr import PaddleOCR
            # use_angle_cls=True for image rotation, lang='en' for English
            _ocr_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            logger.info("✅ PaddleOCR engine loaded.")
        except Exception as e:
            logger.error(f"❌ Error loading PaddleOCR: {e}")
            raise RuntimeError(f"OCR Engine failed to load: {e}")
    return _ocr_engine

async def process_report_for_extraction(file: UploadFile):
    """
    Reads an uploaded image/PDF, extracts text via OCR, and parses medical metrics.
    """
    try:
        file_bytes = await file.read()
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        extracted_text = ""
        
        # Determine if PDF or Image
        if file_ext == '.pdf':
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page in doc:
                    extracted_text += page.get_text() + "\n"
                
                # If the PDF is just scanned images, the text might be empty or very short.
                # In that case, we fallback to rendering the page to an image and running OCR.
                if len(extracted_text.strip()) < 50:
                    logger.info("PDF text too short, falling back to OCR on rendered pages...")
                    extracted_text = ""
                    ocr = get_ocr_engine()
                    for page in doc:
                        pix = page.get_pixmap()
                        img_bytes = pix.tobytes("png")
                        
                        # Save temporarily for PaddleOCR (or pass bytes if supported)
                        temp_path = f"temp_ocr_{uuid.uuid4().hex}.png"
                        with open(temp_path, "wb") as f:
                            f.write(img_bytes)
                            
                        result = ocr.ocr(temp_path, cls=True)
                        if result and result[0]:
                            for line in result[0]:
                                extracted_text += line[1][0] + "\n"
                                
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
            except Exception as e:
                logger.error(f"PDF extraction failed: {e}")
                raise ValueError("Failed to read PDF document.")
        else:
            # Handle standard images
            try:
                ocr = get_ocr_engine()
                temp_path = f"temp_ocr_{uuid.uuid4().hex}{file_ext}"
                with open(temp_path, "wb") as f:
                    f.write(file_bytes)
                
                result = ocr.ocr(temp_path, cls=True)
                if result and result[0]:
                    for line in result[0]:
                        extracted_text += line[1][0] + "\n"
                
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception as e:
                logger.error(f"Image extraction failed: {e}")
                raise ValueError("Failed to process image for OCR.")

        # Now we parse the text
        parsed_data = parse_medical_text(extracted_text)
        
        return {
            "success": True,
            "raw_text": extracted_text,
            "extracted_data": parsed_data
        }

    except Exception as e:
        logger.error(f"OCR Extraction Error: {e}")
        return {"success": False, "error": str(e)}

def parse_medical_text(text: str) -> dict:
    """
    Uses regex to extract common medical metrics from OCR text.
    """
    text = text.lower()
    data = {}
    
    # Extract Age
    age_match = re.search(r'(?:age|yr|yrs|y/o|years old)[\s:\-]+(\d{1,3})', text)
    if age_match:
        age = int(age_match.group(1))
        if 0 < age < 120:
            data['age'] = age
            
    # Extract Sex/Gender
    if re.search(r'\b(?:sex|gender)[\s:\-]+male\b', text) or re.search(r'\b(?:m|male)\b(?!\s*l\/)', text):
        data['sex'] = 1 # Male
    elif re.search(r'\b(?:sex|gender)[\s:\-]+female\b', text) or re.search(r'\b(?:f|female)\b', text):
        data['sex'] = 0 # Female

    # Extract BP (trestbps)
    # Looks for something like "120/80" or "BP 140/90"
    bp_match = re.search(r'(?:bp|blood pressure)?\s*(\d{2,3})\s*/\s*(\d{2,3})', text)
    if bp_match:
        systolic = int(bp_match.group(1))
        if 70 < systolic < 250:
            data['trestbps'] = systolic

    # Extract Cholesterol (chol)
    chol_match = re.search(r'(?:cholesterol|chol)[\s:\-]+(\d{2,3})', text)
    if chol_match:
        chol = int(chol_match.group(1))
        if 100 < chol < 600:
            data['chol'] = chol

    # Extract Heart Rate (thalach)
    hr_match = re.search(r'(?:heart rate|pulse|hr|bpm)[\s:\-]+(\d{2,3})', text)
    if hr_match:
        hr = int(hr_match.group(1))
        if 40 < hr < 220:
            data['thalach'] = hr
            
    # Extract Fasting Blood Sugar (fbs)
    fbs_match = re.search(r'(?:fasting blood sugar|fbs|glucose)[\s:\-]+(\d{2,3})', text)
    if fbs_match:
        fbs = int(fbs_match.group(1))
        data['glucose'] = fbs
        if fbs > 120:
            data['fbs'] = 1
        else:
            data['fbs'] = 0
            
    return data
