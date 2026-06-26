export type AnalyzeResponse = {
    match_score: number;
    matched_skills: string[];
    missing_skills: string[];
    summary: string;
    strengths: string[];
    improvement_suggestions: string[];
    honesty_notes: string[];
    resume_length: number;
    job_description_length: number;

    company_name: string | null;
    job_title: string | null;
    job_link: string | null;
    application_status: string;
    notes: string | null;
    follow_up_date: string | null;
};

export type SavedAnalysis = {
    id: number;
    resume_text: string;
    job_description: string;

    company_name: string | null;
    job_title: string | null;
    job_link: string | null;
    application_status: string;
    notes: string | null;
    follow_up_date: string | null;

    match_score:number;
    matched_skills: string[];
    missing_skills: string[];
    summary: string;
    strengths: string[];
    improvement_suggestions: string[];
    honesty_notes: string[];

    created_at: string;
};