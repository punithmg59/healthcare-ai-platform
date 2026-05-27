from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from datetime import datetime

from database.database import Base

# =========================
# USERS TABLE
# =========================

class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String)

    age = Column(Integer)

    gender = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)

# =========================
# HEART PREDICTIONS TABLE
# =========================

class HeartPrediction(Base):

    __tablename__ = "heart_predictions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer)

    prediction = Column(Integer)

    risk_level = Column(String)

    base_risk = Column(Float)

    enhanced_risk = Column(Float)

    blood_pressure = Column(Float)

    cholesterol = Column(Float)

    glucose = Column(Float)

    heart_rate = Column(Float)

    smoking = Column(Boolean)

    stress_level = Column(Integer)

    short_breath = Column(Boolean)

    fatigue = Column(Boolean)

    chest_location = Column(Boolean)

    left_arm_pain = Column(Boolean)

    pain_severity = Column(Integer)

    emergency = Column(Boolean)

    report = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)

# =========================
# CHEST X-RAY PREDICTIONS TABLE
# =========================

class ChestXrayPrediction(Base):

    __tablename__ = "chest_xray_predictions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, default=1)

    prediction = Column(String)

    confidence = Column(Float)

    risk_level = Column(String)

    image_path = Column(String)

    heatmap_path = Column(String)

    report = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)

# =========================
# BRAIN TUMOR PREDICTIONS TABLE
# =========================

class BrainTumorPrediction(Base):

    __tablename__ = "brain_tumor_predictions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, default=1)

    prediction = Column(String)

    confidence = Column(Float)

    risk_level = Column(String)

    image_path = Column(String)

    report = Column(String)

    pdf_path = Column(String)

    doctor_suggestions = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)

# =========================
# EXTRACTED DOCUMENTS TABLE
# =========================

class ExtractedDocument(Base):
    __tablename__ = "extracted_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    filepath = Column(String)
    extracted_text = Column(String)
    extracted_data_json = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)