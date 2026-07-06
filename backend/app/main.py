import os
import re
from datetime import datetime, date

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app import models
from app.ai_service import analyze_resume_with_ai
from app.database import Base, engine, get_db
from sqlalchemy.orm import Session


load_dotenv()

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
app = FastAPI(title="AI Job Tracker API")

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str

    company_name: str | None = None
    job_title: str | None = None
    job_link: str | None = None
    application_status: str = "Interested"
    notes: str | None = None
    follow_up_date: date | None = None

class AnalysisUpdateRequest(BaseModel):
    company_name: str | None = None
    job_title: str | None = None
    job_link: str | None = None
    application_status: str | None = None
    notes: str | None = None
    follow_up_date: date | None = None

class SuggestedBulletImprovementResponse(BaseModel):
    original_bullet_or_source_detail: str
    improved_bullet: str
    why_it_is_better: str
    evidence_used: str
    honesty_check: str


class AnalyzeResponse(BaseModel):
    match_score: int
    matched_skills: list[str]
    missing_skills: list[str]
    summary: str
    strengths: list[str]
    improvement_suggestions: list[str]
    honesty_notes: list[str]
    suggested_bullet_improvements: list[SuggestedBulletImprovementResponse]
    resume_length: int
    job_description_length: int

    company_name: str | None = None
    job_title: str | None = None
    job_link: str | None = None
    application_status: str
    notes: str | None = None
    follow_up_date: date | None = None


class SavedAnalysisResponse(BaseModel):
    id: int

    resume_text: str
    job_description: str

    company_name: str | None = None
    job_title: str | None = None
    job_link: str | None = None
    application_status: str
    notes: str | None = None
    follow_up_date: date | None = None

    match_score: int
    matched_skills: list[str]
    missing_skills: list[str]
    summary: str
    strengths: list[str]
    improvement_suggestions: list[str]
    honesty_notes: list[str]
    suggested_bullet_improvements: list[SuggestedBulletImprovementResponse]

    created_at: datetime


SKILL_KEYWORDS = {
    "Python": ["python"],
    "JavaScript": ["javascript"],
    "TypeScript": ["typescript"],
    "React": ["react"],
    "Next.js": ["next.js", "nextjs"],
    "FastAPI": ["fastapi"],
    "SQL": ["sql", "postgresql", "mysql"],
    "Machine Learning": ["machine learning", "ml"],
    "API": ["rest api", "api development", "apis"],
    "Git": ["git", "github"],
}

def contains_keyword(text: str, keyword: str) -> bool:
    pattern = r"\b" + re.escape(keyword) + r"\b"
    return re.search(pattern, text) is not None


def create_summary(match_score: int) -> str:
    if match_score >= 80:
        return "This resume is a strong match for the job description."
    if match_score >= 50:
        return "This resume is a decent match, but it is missing a few important skills."
    if match_score > 0:
        return "This resume has some relevant skills, but it needs improvement for this role."

    return "This resume does not strongly match the job description based on the current keyword check."

def build_saved_analysis_response(analysis: models.Analysis) -> SavedAnalysisResponse:
    return SavedAnalysisResponse(
        id=analysis.id,
        resume_text=analysis.resume_text,
        job_description=analysis.job_description,

        company_name=analysis.company_name,
        job_title=analysis.job_title,
        job_link=analysis.job_link,
        application_status=analysis.application_status,
        notes=analysis.notes,
        follow_up_date=analysis.follow_up_date,

        match_score=analysis.match_score,
        matched_skills=analysis.matched_skills,
        missing_skills=analysis.missing_skills,
        summary=analysis.summary,
        strengths=analysis.strengths,
        improvement_suggestions=analysis.improvement_suggestions,
        honesty_notes=analysis.honesty_notes,
        suggested_bullet_improvements=analysis.suggested_bullet_improvements,

        created_at=analysis.created_at,
    )


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/analyses", response_model=list[SavedAnalysisResponse])
def get_saved_analyses(db: Session = Depends(get_db)):
    saved_analyses = db.query(models.Analysis).order_by(models.Analysis.id.desc()).all()

    return [
        build_saved_analysis_response(analysis)
        for analysis in saved_analyses
    ]

@app.put("/analyses/{analysis_id}", response_model=SavedAnalysisResponse)
def update_saved_analysis(
    analysis_id: int,
    request: AnalysisUpdateRequest,
    db: Session = Depends(get_db),
):
    saved_analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id)
        .first()
    )

    if saved_analysis is None:
        raise HTTPException(status_code=404, detail="Saved analysis not found")
    
    update_data = request.model_dump(exclude_unset=True)

    for field_name, field_value in update_data.items():
        setattr(saved_analysis, field_name, field_value)

    db.commit()
    db.refresh(saved_analysis)

    return build_saved_analysis_response(saved_analysis)

@app.delete("/analyses/{analysis_id}")
def delete_saved_analysis(analysis_id: int, db: Session = Depends(get_db)):
    saved_analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id)
        .first()
    )

    if saved_analysis is None:
        raise HTTPException(status_code=404, detail="saved analysis not found")
    
    db.delete(saved_analysis)
    db.commit()

    return {
        "message": "Saved analysis deleted successfully",
        "deleted_id": analysis_id,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_job_match(request: AnalyzeRequest, db: Session = Depends(get_db)):
    analysis_result = analyze_resume_with_ai(
        resume_text=request.resume_text,
        job_description=request.job_description,
        company_name=request.company_name,
        job_title=request.job_title,
    )

    match_score = analysis_result["match_score"]
    matched_skills = analysis_result["matched_skills"]
    missing_skills = analysis_result["missing_skills"]
    summary = analysis_result["summary"]
    strengths = analysis_result["strengths"]
    improvement_suggestions = analysis_result["improvement_suggestions"]
    honesty_notes = analysis_result["honesty_notes"]
    suggested_bullet_improvements = analysis_result["suggested_bullet_improvements"]

    saved_analysis = models.Analysis(
        resume_text=request.resume_text,
        job_description=request.job_description,

        company_name=request.company_name,
        job_title=request.job_title,
        job_link=request.job_link,
        application_status=request.application_status,
        notes=request.notes,
        follow_up_date=request.follow_up_date,

        match_score=match_score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        summary=summary,
        strengths=strengths,
        improvement_suggestions=improvement_suggestions,
        honesty_notes=honesty_notes,
        suggested_bullet_improvements=suggested_bullet_improvements,
    )

    db.add(saved_analysis)
    db.commit()
    db.refresh(saved_analysis)

    return AnalyzeResponse(
        match_score=match_score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        summary=summary,
        strengths=strengths,
        improvement_suggestions=improvement_suggestions,
        honesty_notes=honesty_notes,
        suggested_bullet_improvements=suggested_bullet_improvements,
        resume_length=len(request.resume_text),
        job_description_length=len(request.job_description),

        company_name=request.company_name,
        job_title=request.job_title,
        job_link=request.job_link,
        application_status=request.application_status,
        notes=request.notes,
        follow_up_date=request.follow_up_date,
    )