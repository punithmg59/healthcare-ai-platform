from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from database.database import SessionLocal
from database.db_models import HeartPrediction

import joblib
import numpy as np
import json
import os
import shutil
from pathlib import Path
from typing import List, Optional

from models.heart.risk_engine import enhance_risk
from services.groq_service import generate_medical_report
from services.ocr_service import process_report_for_extraction
from services.medical_data_extraction import get_medical_data_extractor

# =========================
# ROUTER
# =========================

router = APIRouter()

# =========================
# LOAD MODEL (LAZY)
# =========================

_heart_model = None

def get_heart_model():
    global _heart_model
    if _heart_model is None:
        try:
            path = "models/heart/heart_model.pkl"
            if os.path.exists(path):
                print(f"⏳ Loading Heart model from {path}...")
                _heart_model = joblib.load(path)
                print("✅ Heart model loaded.")
            else:
                print(f"⚠️ Heart model not found at {path}")
        except Exception as e:
            print(f"❌ Error loading Heart model: {e}")
    return _heart_model

# =========================
# REQUEST MODEL
# =========================

class HeartRequest(BaseModel):

    # Main ML Features
    age: int
    sex: int
    cp: int
    trestbps: float
    chol: float
    fbs: int
    thalach: float
    exang: int

    # Enhancement Features
    smoking: int
    stress_level: int
    short_breath: int
    fatigue: int
    chest_location: int
    left_arm_pain: int
    pain_severity: int

# =========================
# PREDICT ROUTE
# =========================

@router.post("/predict-heart")
async def predict_heart(data: HeartRequest):

    db = SessionLocal()

    try:

        # =========================
        # CHECK MODEL
        # =========================

        heart_model = get_heart_model()
        if heart_model is None:
            raise HTTPException(
                status_code=500,
                detail="Heart model not available"
            )

        # =========================
        # MAIN MODEL FEATURES
        # =========================

        user_features = np.array([[
            data.age,
            data.sex,
            data.cp,
            data.trestbps,
            data.chol,
            data.fbs,
            data.thalach,
            data.exang
        ]])

        # =========================
        # PREDICTION
        # =========================

        prediction = heart_model.predict(user_features)

        probability = heart_model.predict_proba(user_features)

        base_risk = float(probability[0][1])

        # =========================
        # ENHANCED RISK
        # =========================

        enhanced_risk = enhance_risk(
            base_risk=base_risk,
            smoking=data.smoking,
            stress_level=data.stress_level,
            short_breath=data.short_breath,
            fatigue=data.fatigue,
            chest_location=data.chest_location,
            left_arm_pain=data.left_arm_pain,
            pain_severity=data.pain_severity
        )

        # =========================
        # RISK LEVEL
        # =========================

        if enhanced_risk < 0.30:
            risk_level = "LOW RISK"

        elif enhanced_risk < 0.60:
            risk_level = "MODERATE RISK"

        else:
            risk_level = "HIGH RISK"

        # =========================
        # REASONS
        # =========================

        reasons = []

        if data.smoking == 1:
            reasons.append("Smoking history")

        if data.stress_level >= 8:
            reasons.append("High stress level")

        if data.short_breath == 1:
            reasons.append("Shortness of breath")

        if data.fatigue == 1:
            reasons.append("Frequent fatigue")

        if data.chest_location == 1:
            reasons.append("Chest pain symptoms")

        if data.left_arm_pain == 1:
            reasons.append("Left arm pain")

        if data.trestbps > 140:
            reasons.append("High blood pressure")

        if data.chol > 240:
            reasons.append("High cholesterol")

        # =========================
        # RECOMMENDATION
        # =========================

        if risk_level == "HIGH RISK":
            recommendation = (
                "Consult a cardiologist immediately."
            )

        elif risk_level == "MODERATE RISK":
            recommendation = (
                "Lifestyle improvements and medical consultation recommended."
            )

        else:
            recommendation = (
                "Maintain healthy lifestyle and regular checkups."
            )

        # =========================
        # SAVE PREDICTION
        # =========================

        prediction_record = HeartPrediction(
            user_id=1,
            prediction=int(prediction[0]),
            risk_level=risk_level,
            base_risk=base_risk,
            enhanced_risk=enhanced_risk,
            blood_pressure=data.trestbps,
            cholesterol=data.chol,
            glucose=data.fbs,
            heart_rate=data.thalach,
            smoking=bool(data.smoking),
            stress_level=data.stress_level,
            short_breath=bool(data.short_breath),
            fatigue=bool(data.fatigue),
            chest_location=bool(data.chest_location),
            left_arm_pain=bool(data.left_arm_pain),
            pain_severity=data.pain_severity,
            emergency=enhanced_risk >= 0.85
        )

        db.add(prediction_record)
        db.commit()

        # =========================
        # GEMINI API CALL
        # =========================

        gemini_input = {
            "risk_level": risk_level,
            "risk_score": round(enhanced_risk, 2),
            "age": data.age,
            "symptoms": reasons,
            "pain_areas": [],
            "smoking_status": "Yes" if data.smoking == 1 else "No",
            "stress_level": data.stress_level,
            "blood_pressure": data.trestbps,
            "cholesterol": data.chol,
            "glucose": "High (>120)" if data.fbs == 1 else "Normal",
            "prediction_result": "Positive for heart disease risk" if int(prediction[0]) == 1 else "Negative for heart disease risk"
        }

        if data.chest_location == 1:
            gemini_input["pain_areas"].append("chest")
        if data.left_arm_pain == 1:
            gemini_input["pain_areas"].append("left_arm")

        gemini_report = generate_medical_report(gemini_input)
        
        prediction_record.report = json.dumps(gemini_report) if isinstance(gemini_report, dict) else str(gemini_report)
        db.commit()

        # =========================
        # RESPONSE
        # =========================

        return {

            "success": True,

            "prediction": int(prediction[0]),

            "risk_level": risk_level,

            "base_risk": round(base_risk, 2),

            "enhanced_risk": round(enhanced_risk, 2),

            "reasons": reasons,

            "recommendation": recommendation,

            "emergency": enhanced_risk >= 0.85,
            
            "gemini_report": gemini_report
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        db.close()


# =========================
# MULTIMODAL PREDICTION ROUTE (WITH DOCUMENT UPLOAD)
# =========================

UPLOAD_DIRECTORY = "uploads/medical_documents"
SUPPORTED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/predict-heart-multimodal")
async def predict_heart_multimodal(
    age: int = Form(...),
    sex: int = Form(...),
    cp: int = Form(...),
    trestbps: float = Form(...),
    chol: float = Form(...),
    fbs: int = Form(...),
    thalach: float = Form(...),
    exang: int = Form(...),
    smoking: int = Form(...),
    stress_level: int = Form(...),
    short_breath: int = Form(...),
    fatigue: int = Form(...),
    chest_location: int = Form(...),
    left_arm_pain: int = Form(...),
    pain_severity: int = Form(...),
    pain_areas: str = Form(default="[]"),
    documents: List[UploadFile] = File(default=[])
):
    """
    Multimodal prediction endpoint that accepts:
    - Form data (health information)
    - Pain areas selection
    - Medical documents (PDF, images)
    
    Processes documents with OCR and combines all data for enhanced prediction
    """
    
    db = SessionLocal()
    uploaded_files = []
    
    try:
        # Create upload directory if it doesn't exist
        os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)
        
        # Parse pain areas
        try:
            pain_areas_list = json.loads(pain_areas) if isinstance(pain_areas, str) else pain_areas
        except json.JSONDecodeError:
            pain_areas_list = []
        
        # =========================
        # PROCESS UPLOADED DOCUMENTS
        # =========================
        
        ocr_extracted_data = {}
        all_extracted_texts = {}
        
        if documents:
            for document in documents:
                    # Detect document type dynamically
                    filename_lower = document.filename.lower()
                    document_type = "blood_report"
                    if "xray" in filename_lower or "x-ray" in filename_lower:
                        document_type = "xray"
                    elif "ct" in filename_lower or "scan" in filename_lower:
                        document_type = "ctscan"
                    
                    print(f"Document type: {document_type}")
                    
                    # If it's an X-Ray or CT Scan, we MUST route it to the image AI pipeline
                    if document_type in ["xray", "ctscan"]:
                        from services.xray_service import process_chest_xray
                        
                        # Reset the file cursor so process_chest_xray can read it
                        await document.seek(0)
                        
                        print("Routing to Image AI Pipeline...")
                        xray_result = await process_chest_xray(document)
                        
                        print("Prediction:", xray_result.get("prediction"))
                        print("Confidence:", xray_result.get("confidence"))
                        print("Generated report:", xray_result.get("report"))
                        
                        xray_result["type"] = "xray"
                        
                        # The process_chest_xray returns the exact structure expected by the frontend PredictionReport
                        # We just return it directly and short-circuit the tabular heart pipeline
                        return xray_result

                    # Validate file
                    file_ext = Path(document.filename).suffix.lower()
                    if file_ext not in SUPPORTED_EXTENSIONS:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Unsupported file type: {file_ext}. Supported: {SUPPORTED_EXTENSIONS}"
                        )
                    
                    # Save uploaded file
                    file_path = os.path.join(UPLOAD_DIRECTORY, document.filename)
                    with open(file_path, "wb") as f:
                        content = await document.read()
                        if len(content) > MAX_FILE_SIZE:
                            raise HTTPException(
                                status_code=413,
                                detail=f"File too large. Maximum: 10MB"
                            )
                        f.write(content)
                    
                    uploaded_files.append(file_path)
                    
                    # Extract text and medical values using OCR
                    try:
                        # Reset cursor since it was read above
                        await document.seek(0)
                        
                        ocr_result = await process_report_for_extraction(document)
                        
                        if ocr_result.get("success"):
                            extracted_text = ocr_result.get("raw_text", "")
                            medical_vals = ocr_result.get("extracted_data", {})
                            
                            all_extracted_texts[document.filename] = extracted_text
                            # Merge medical values (later documents override earlier ones)
                            ocr_extracted_data.update(medical_vals)
                        else:
                            print(f"OCR failed for {document.filename}: {ocr_result.get('error')}")
                            
                    except Exception as e:
                        print(f"OCR processing error for {document.filename}: {e}")
                        # Continue with other documents even if one fails
        
        # =========================
        # DATA INTEGRATION
        # =========================
        
        # Create form data dictionary
        form_data = {
            'age': age,
            'sex': sex,
            'cp': cp,
            'trestbps': trestbps,
            'chol': chol,
            'fbs': fbs,
            'thalach': thalach,
            'exang': exang,
            'smoking': smoking,
            'stress_level': stress_level,
            'short_breath': short_breath,
            'fatigue': fatigue,
            'chest_location': chest_location,
            'left_arm_pain': left_arm_pain,
            'pain_severity': pain_severity,
        }
        
        # Extract and combine data using medical data extractor
        extractor = get_medical_data_extractor()
        combined_data = extractor.combine_data_sources(
            form_data=form_data,
            pain_areas=pain_areas_list,
            ocr_values=ocr_extracted_data
        )
        
        # Get ML features
        ml_features = combined_data['ml_features']
        
        # =========================
        # CHECK MODEL
        # =========================
        
        if model is None:
            raise HTTPException(
                status_code=500,
                detail="Heart model not loaded"
            )
        
        # =========================
        # PREPARE FEATURES FOR MODEL
        # =========================
        
        # Use ML features dictionary to create numpy array in correct order
        user_features = np.array([[
            ml_features.get('age', age),
            ml_features.get('sex', sex),
            ml_features.get('cp', cp),
            ml_features.get('trestbps', trestbps),
            ml_features.get('chol', chol),
            ml_features.get('fbs', fbs),
            ml_features.get('thalach', thalach),
            ml_features.get('exang', exang)
        ]])
        
        # =========================
        # PREDICTION
        # =========================

        heart_model = get_heart_model()
        if heart_model is None:
            raise HTTPException(status_code=500, detail="Heart model not available")
            
        prediction = heart_model.predict(user_features)
        probability = heart_model.predict_proba(user_features)
        base_risk = float(probability[0][1])
        
        # =========================
        # ENHANCED RISK
        # =========================
        
        enhanced_risk = enhance_risk(
            base_risk=base_risk,
            smoking=smoking,
            stress_level=stress_level,
            short_breath=short_breath,
            fatigue=fatigue,
            chest_location=chest_location,
            left_arm_pain=left_arm_pain,
            pain_severity=pain_severity
        )
        
        # Apply OCR-based risk adjustment
        ocr_risk_adjustment = 0
        if ocr_extracted_data.get('chol', 0) > 240:
            ocr_risk_adjustment += 0.05
        if ocr_extracted_data.get('trestbps', 0) > 160:
            ocr_risk_adjustment += 0.05
        if ocr_extracted_data.get('abnormalities'):
            ocr_risk_adjustment += 0.1
        if ocr_extracted_data.get('ecg_findings'):
            ecg_findings = ocr_extracted_data['ecg_findings']
            if 'ST Elevation' in ecg_findings or 'ST Depression' in ecg_findings:
                ocr_risk_adjustment += 0.15
        
        final_risk = min(enhanced_risk + ocr_risk_adjustment, 1.0)  # Cap at 1.0
        
        # =========================
        # RISK LEVEL
        # =========================
        
        if final_risk < 0.30:
            risk_level = "LOW RISK"
        elif final_risk < 0.60:
            risk_level = "MODERATE RISK"
        else:
            risk_level = "HIGH RISK"
        
        # =========================
        # REASONS / FINDINGS
        # =========================
        
        reasons = []
        
        if smoking == 1:
            reasons.append("Smoking history")
        if stress_level >= 8:
            reasons.append("High stress level")
        if short_breath == 1:
            reasons.append("Shortness of breath")
        if fatigue == 1:
            reasons.append("Frequent fatigue")
        if chest_location == 1:
            reasons.append("Chest pain symptoms")
        if left_arm_pain == 1:
            reasons.append("Left arm pain")
        if trestbps > 140:
            reasons.append("High blood pressure (form)")
        if chol > 240:
            reasons.append("High cholesterol (form)")
        
        # Add OCR findings
        if ocr_extracted_data.get('chol', 0) > 240:
            reasons.append("High cholesterol (OCR)")
        if ocr_extracted_data.get('trestbps', 0) > 140:
            reasons.append("High blood pressure (OCR)")
        if ocr_extracted_data.get('glucose', 0) > 126:
            reasons.append("Elevated glucose (OCR)")
        if ocr_extracted_data.get('abnormalities'):
            reasons.extend([f"Abnormality: {abn}" for abn in ocr_extracted_data['abnormalities']])
        if ocr_extracted_data.get('ecg_findings'):
            reasons.extend(ocr_extracted_data['ecg_findings'])
        if combined_data['pain_analysis'].get('high_risk_pain', False):
            reasons.append("High-risk pain areas detected")
        
        # Remove duplicates while preserving order
        reasons = list(dict.fromkeys(reasons))
        
        # =========================
        # RECOMMENDATION
        # =========================
        
        if risk_level == "HIGH RISK":
            recommendation = "Consult a cardiologist immediately. Consider emergency evaluation if symptoms persist."
        elif risk_level == "MODERATE RISK":
            recommendation = "Lifestyle improvements and medical consultation recommended. Schedule an appointment with your doctor."
        else:
            recommendation = "Maintain healthy lifestyle and regular checkups. Continue monitoring your health."
        
        # =========================
        # SAVE PREDICTION
        # =========================
        
        prediction_record = HeartPrediction(
            user_id=1,
            prediction=int(prediction[0]),
            risk_level=risk_level,
            base_risk=base_risk,
            enhanced_risk=final_risk,
            blood_pressure=ocr_extracted_data.get('trestbps', trestbps),
            cholesterol=ocr_extracted_data.get('chol', chol),
            glucose=fbs,
            heart_rate=ocr_extracted_data.get('thalach', thalach),
            smoking=bool(smoking),
            stress_level=stress_level,
            short_breath=bool(short_breath),
            fatigue=bool(fatigue),
            chest_location=bool(chest_location),
            left_arm_pain=bool(left_arm_pain),
            pain_severity=pain_severity,
            emergency=final_risk >= 0.85
        )
        
        db.add(prediction_record)
        db.commit()
        db.refresh(prediction_record)
        
        # =========================
        # GEMINI/GROQ API CALL (Optional - can be integrated)
        # =========================
        
        gemini_input = {
            "risk_level": risk_level,
            "risk_score": round(final_risk, 2),
            "age": age,
            "symptoms": reasons,
            "pain_areas": pain_areas_list,
            "smoking_status": "Yes" if smoking == 1 else "No",
            "stress_level": stress_level,
            "blood_pressure": f"{ocr_extracted_data.get('trestbps', trestbps)}/{ocr_extracted_data.get('bp_diastolic', 'N/A')}",
            "cholesterol": ocr_extracted_data.get('chol', chol),
            "glucose": "High (>120)" if fbs == 1 else "Normal",
            "prediction_result": "Positive for heart disease risk" if int(prediction[0]) == 1 else "Negative for heart disease risk",
            "documents_processed": len(uploaded_files),
            "data_completeness": combined_data['summary']['data_completeness']
        }
        
        gemini_report = generate_medical_report(gemini_input)
        
        prediction_record.report = json.dumps(gemini_report) if isinstance(gemini_report, dict) else str(gemini_report)
        db.commit()
        
        # =========================
        # RESPONSE
        # =========================
        
        return {
            "success": True,
            "prediction": int(prediction[0]),
            "risk_level": risk_level,
            "risk_score": round(final_risk * 100),
            "emergency": final_risk >= 0.85,
            
            # Symptoms and Pain Areas
            "symptoms": reasons,
            "selected_pain_areas": pain_areas_list,
            
            # Biometrics for frontend rendering
            "blood_pressure": f"{ocr_extracted_data.get('trestbps', trestbps)}/{ocr_extracted_data.get('bp_diastolic', 'N/A')}",
            "heart_rate": ocr_extracted_data.get('thalach', thalach),
            
            # AI Generated Report
            "llm_report": gemini_report,
            
            # Additional Details
            "ocr_findings": {
                "cholesterol": ocr_extracted_data.get('chol'),
                "glucose": ocr_extracted_data.get('glucose'),
                "blood_pressure": f"{ocr_extracted_data.get('trestbps')}/{ocr_extracted_data.get('bp_diastolic', 'N/A')}",
                "heart_rate": ocr_extracted_data.get('thalach'),
                "abnormalities": ocr_extracted_data.get('abnormalities', []),
                "ecg_findings": ocr_extracted_data.get('ecg_findings', []),
            },
            
            "documents_processed": {
                "count": len(uploaded_files),
                "files": [Path(f).name for f in uploaded_files]
            }
        }
    
    except HTTPException as he:
        raise he
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Prediction error: {str(e)}"
        )
    
    finally:
        db.close()
        # Optional: Clean up uploaded files after processing (or keep for records)
        # for file_path in uploaded_files:
        #     if os.path.exists(file_path):
        #         os.remove(file_path)