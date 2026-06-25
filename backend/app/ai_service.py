import os
import re
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()


class JobMatchAIResponse(BaseModel):
    """
    Defines the exact structure we want back from the AI model.

    This helps the backend and frontend because we get predictable fields
    instead of a random paragraph of text.
    """

    match_score: int = Field(
        ge=0,
        le=100,
        description="A resume-to-job match score from 0 to 100.",
    )
    matched_skills: list[str] = Field(
        description="Short skill or qualification labels clearly present in both the resume and job description. Use concise labels, not full sentences."
    )
    missing_skills: list[str] = Field(
        description="Short labels for important job requirements that are missing or weak in the resume. Use concise labels, not full sentences."
    )
    summary: str = Field(
        description="A short, honest summary of the candidate's fit for the job."
    )
    strengths: list[str] = Field(
        description="Specific strengths the candidate already has for this role."
    )
    improvement_suggestions: list[str] = Field(
        description="Honest suggestions to improve the resume for this role without exaggerating experience."
    )
    honesty_notes: list[str] = Field(
        description="Warnings about what the candidate should not fake, exaggerate, or claim."
    )


def get_openai_config() -> tuple[str, str]:
    """
    Reads OpenAI settings from environment variables.

    Returns:
        A tuple containing:
        - api_key
        - model name

    Raises:
        RuntimeError if OPENAI_API_KEY is missing.
    """

    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")

    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is missing. Add it to backend/.env before using AI analysis."
        )
    
    return api_key, model


SKILL_KEYWORDS = [
    "Python",
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "FastAPI",
    "SQL",
    "PostgreSQL",
    "SQLite",
    "Machine Learning",
    "AI",
    "Git",
    "GitHub",
    "Docker",
    "REST API",
    "APIs",
    "Tailwind",
    "HTML",
    "CSS",
]


def analyze_with_placeholder(resume_text: str, job_description: str) -> dict[str, Any]:
    """
    Fallback analysis used if the AI call fails.

    This keeps the app usable even if the API is temporarily unavailable.
    """

    resume_lower = resume_text.lower()
    job_lower = job_description.lower()

    matched_skills: list[str] = []
    missing_skills: list[str] = []

    for skill in SKILL_KEYWORDS:
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        skill_in_resume = re.search(pattern, resume_lower)
        skill_in_job = re.search(pattern, job_lower)

        if skill_in_job and skill_in_resume:
            matched_skills.append(skill)
        elif skill_in_job and not skill_in_resume:
            missing_skills.append(skill)
    
    total_relevant_skills = len(matched_skills) + len(missing_skills)

    if total_relevant_skills == 0:
        match_score = 0
    else:
        match_score = round((len(matched_skills) / total_relevant_skills) * 100)

    return {
        "match_score": match_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "summary": "AI analysis was unavailable, so this fallback result used basic keyword matching.",
        "strengths": matched_skills,
        "improvement_suggestions": [
            "Review the missing skills and honestly add any that you have real experience with.",
            "Add specific projects, tools, and measurable outcomes where possible.",
        ],
        "honesty_notes": [
            "Do not claim experience with skills you have not actually used.",
            "Use class projects, personal projects, or portfolio projects honestly instead of fake work experience.",
        ],
    }


def analyze_resume_with_ai(
    resume_text: str,
    job_description: str,
    company_name: str | None = None,
    job_title: str | None = None,
) -> dict[str, Any]:
    """
    Main analysis function.

    This tries to call the OpenAI API for structured resume/job analysis.
    If the AI call fails, it falls back to basic keyword matching.
    """

    api_key, model = get_openai_config()
    client = OpenAI(api_key=api_key)

    job_context = ""

    if company_name:
        job_context += f"Company: {company_name}\n"

    if job_title:
        job_context += f"Job title: {job_title}\n"

    system_prompt = """
    You are an honest AI career assistant helping a new computer science graduate improve their resume for job applications.
    
    Your job:
    - Compare the resume against the job description.
    - Identify real matches.
    - Identify missing or weak qualifications.
    - Suggest honest resume improvements.
    - Do not tell the user to fake experience.
    - Do not invent experience that is not supported by the resume.
    - Be encouraging but realistic.
    - Keep suggestions practical for a portfolio project and entry-level job search.
    - For matched_skills, only include skills or qualifications that are clearly supported by the resume.
    - Do not count a skill as matched just because it appears in the job description.
    - Keep matched_skills and missing_skills concise, usually 1 to 4 words each.
    - Do not put full sentences or long explanations in matched_skills or missing_skills.
    - Use strengths for longer evidence-based explanations.
    - Example good matched_skills: "SQL", "Python", "Data Modeling", "Database Design".
    - Example bad matched_skills: "database coursework involving relational schemas, SQL queries, joins, normalization, and basic data modeling".
    - Do not infer professional experience from school projects or portfolio projects.
    - If a skill is only implied, mention it in improvement_suggestions instead of matched_skills.
    - If the resume says Next.js but not React, you may say the user should explicitly mention React if they used it, but do not automatically count React as a confirmed matched skill.
    - Treat "nice to have" requirements as gaps, but do not punish the score as heavily as required qualifications.

    Scoring guidance:
    - 90-100: Very strong match.
    - 75-89: Strong match with some gaps.
    - 60-74: Decent match but needs targeted improvements.
    - 40-59: Partial match with important gaps.
    - 0-39: Weak match.
    """

    user_prompt = f"""
    Analyze this resume against this job description.

    {job_context}

    RESUME:
    {resume_text}

    JOB DESCRIPTION:
    {job_description}
    """

    try:
        response = client.responses.parse(
            model=model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            text_format=JobMatchAIResponse,
        )

        ai_result = response.output_parsed

        if ai_result is None:
            raise RuntimeError("OpenAI returned an empty structured response.")
        
        return ai_result.model_dump()
    
    except Exception as error:
        print(f"AI analysis failed. Falling back to placeholder analysis. Error: {error}")
        return analyze_with_placeholder(resume_text, job_description)
