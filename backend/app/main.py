from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Backend is running"
    }

@app.post("/analyze")
def analyze_match(request: AnalyzeRequest):
    return {
        "message": "Analyis received successfully.",
        "resume_length" : len(request.resume_text),
        "job_description_length" :len(request.job_description)
    }