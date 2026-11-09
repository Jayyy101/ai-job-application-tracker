export type DocumentVersion = {
  id: string; application_id: string; kind: "resume" | "job"; label: string; text: string;
  passages: { id: string; start: number; end: number; text: string }[];
  parent_id: string | null; origin: string; created_at: string;
};
export type Citation = { document_id: string; passage_id: string; quote: string };
export type Requirement = { id: string; text: string; importance: "required" | "preferred" | "unspecified"; assessment: "supported" | "partially_supported" | "not_evidenced"; explanation: string; experience_context: string; job_evidence: Citation; evidence: Citation[] };
export type Revision = { id: string; source: Citation; proposed: string; rationale: string; clarification_ids: string[] };
export type ReviewEvent = { id: string; review_id: string; kind: "clarification" | "decision"; target_id: string; created_at: string; payload: { answer: string | null; decision: "accept" | "edit" | "reject" | null; text: string | null; confirmed_facts: boolean } };
export type ReviewRun = {
  id: string; application_id: string; resume_id: string; job_id: string; status: string; mode: string;
  model_requested: string | null; model_returned: string | null; prompt_version: string | null; schema_version: string | null;
  created_at: string; finished_at: string | null; latency_ms: number | null; usage: Record<string, unknown> | null;
  provider_response_id: string | null; error: string | null; validation_issues: string[] | null;
  input_snapshot: { clarifications: { event_id: string; answer: string; question: string }[] };
  result: { summary: string; requirements: Requirement[]; clarifications: { id: string; question: string; requirement_id: string | null }[]; revisions: Revision[] } | null;
  events: ReviewEvent[]; applied_versions: { document_id: string; event_ids: string[] }[];
};
export type ReviewConfig = { mode: string; model: string | null; ready: boolean; message: string };
export type Workspace = { documents: DocumentVersion[]; reviews: ReviewRun[]; legacy: { legacy_id: string; raw_record: Record<string, unknown> }[]; config: ReviewConfig };
