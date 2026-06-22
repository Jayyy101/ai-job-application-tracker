from sqlalchemy import Column, Integer, Text, DateTime, JSON, String, Date, func
from app.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)

    resume_text = Column(Text, nullable=False)
    job_description = Column(Text, nullable=False)

    company_name = Column(String, nullable=True)
    job_title = Column(String, nullable=True)
    job_link = Column(String, nullable=True)
    application_status = Column(String, nullable=False, default="Interested", server_default="Interested")
    notes = Column(Text, nullable=True)
    follow_up_date = Column(Date, nullable=True)

    match_score = Column(Integer, nullable=False)
    matched_skills = Column(JSON, nullable=False)
    missing_skills = Column(JSON, nullable=False)
    summary = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

