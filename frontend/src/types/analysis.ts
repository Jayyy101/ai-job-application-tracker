export type SuggestedBulletImprovement = {
    original_bullet_or_source_detail: string;
    improved_bullet: string;
    why_it_is_better: string;
    evidence_used: string;
    honesty_check: string;
}
export type AnalyzeResponse = {
    match_score: number;
    matched_skills: string[];
    missing_skills: string[];
    summary: string;
    strengths: string[];
    improvement_suggestions: string[];
    honesty_notes: string[];
    suggested_bullet_improvements: SuggestedBulletImprovement[];
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
    suggested_bullet_improvements: SuggestedBulletImprovement[];

    created_at: string;
};