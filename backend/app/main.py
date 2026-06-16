import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str


class AnalyzeResponse(BaseModel):
    match_score: int
    matched_skills: list[str]
    missing_skills: list[str]
    summary: str
    resume_length: int
    job_description_length: int


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


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_job_match(request: AnalyzeRequest):
    resume_text_lower = request.resume_text.lower()
    job_description_lower = request.job_description.lower()

    required_skills = []

    for skill, keywords in SKILL_KEYWORDS.items():
        for keyword in keywords:
            if contains_keyword(job_description_lower, keyword):
                required_skills.append(skill)
                break

    matched_skills = []

    for skill in required_skills:
        keywords = SKILL_KEYWORDS[skill]

        for keyword in keywords:
            if contains_keyword(resume_text_lower, keyword):
                matched_skills.append(skill)
                break

    missing_skills = []

    for skill in required_skills:
        if skill not in matched_skills:
            missing_skills.append(skill)

    if len(required_skills) == 0:
        match_score = 0
    else:
        match_score = round((len(matched_skills) / len(required_skills)) * 100)

    summary = create_summary(match_score)

    return AnalyzeResponse(
        match_score=match_score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        summary=summary,
        resume_length=len(request.resume_text),
        job_description_length=len(request.job_description),
    )