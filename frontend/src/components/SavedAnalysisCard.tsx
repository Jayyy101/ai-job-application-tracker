import { FeedbackList } from "@/components/FeedbackList";
import { SkillTagList } from "@/components/SkillTagList";
import type { SavedAnalysis } from "@/types/analysis";

type SavedAnalysisCardProps = {
  analysis: SavedAnalysis;
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

function formatFollowUpDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString();
}

export function SavedAnalysisCard({ analysis }: SavedAnalysisCardProps) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 shadow-sm transition hover:border-slate-500">
      <div className="mb-5 flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Job Application
          </p>

          <h3 className="mt-1 text-xl font-bold text-white">
            {analysis.job_title || "Untitled Role"}
          </h3>

          <p className="mt-1 text-sm text-slate-300">
            {analysis.company_name || "Unknown Company"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              {analysis.application_status}
            </span>

            {analysis.follow_up_date && (
              <span className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
                Follow-up: {formatFollowUpDate(analysis.follow_up_date)}
              </span>
            )}

            {analysis.job_link && (
              <a
                href={analysis.job_link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 hover:border-blue-400 hover:text-blue-300"
              >
                View job posting
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 lg:text-right">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Match Score
            </p>
            <p className="mt-1 text-3xl font-bold text-blue-400">
              {analysis.match_score}%
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI Summary
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {analysis.summary}
        </p>
      </div>

      {(analysis.notes || analysis.follow_up_date) && (
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {analysis.follow_up_date && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Follow-up Date
              </p>
              <p className="mt-1 text-sm text-slate-200">
                {formatFollowUpDate(analysis.follow_up_date)}
              </p>
            </div>
          )}

          {analysis.notes && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {analysis.notes}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <SkillTagList
          title="Matched Skills"
          skills={analysis.matched_skills}
          emptyMessage="No matched skills found."
          tone="green"
        />

        <SkillTagList
          title="Missing Skills"
          skills={analysis.missing_skills}
          emptyMessage="No missing skills found."
          tone="red"
        />
      </div>

      <div className="mb-5 grid gap-4 border-t border-slate-800 pt-5 lg:grid-cols-3">
        <FeedbackList
          title="Strengths"
          items={analysis.strengths}
          emptyMessage="No strengths found."
          tone="blue"
        />

        <FeedbackList
          title="Improvement Suggestions"
          items={analysis.improvement_suggestions}
          emptyMessage="No improvement suggestions found."
          tone="yellow"
        />

        <FeedbackList
          title="Honesty Notes"
          items={analysis.honesty_notes}
          emptyMessage="No honesty notes found."
          tone="orange"
          boxed
        />
      </div>

      <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300 hover:text-white">
          Resume and job description previews
        </summary>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resume Preview
            </p>
            <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm leading-relaxed text-slate-400">
              {analysis.resume_text}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Job Description Preview
            </p>
            <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm leading-relaxed text-slate-400">
              {analysis.job_description}
            </p>
          </div>
        </div>
      </details>

      <p className="mt-4 text-xs text-slate-500">
        Saved {formatDate(analysis.created_at)}
      </p>
    </article>
  );
}