from sqlalchemy import Column, DateTime, Integer, JSON, Text
from sqlalchemy.sql import func
from app.database import Base

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)

    resume_text = Column(Text, nullable=False)
    job_description = Column(Text, nullable=False)

    match_score = Column(Integer, nullable=False)
    matched_skills = Column(JSON, nullable=False)
    missing_skills = Column(JSON, nullable=False)

    summary = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

