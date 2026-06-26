import { FeedbackList } from "@/components/FeedbackList";
import { SkillTagList } from "@/components/SkillTagList";
import type { AnalyzeResponse } from "@/types/analysis";

type CurrentAnalysisCardProps = {
  analysis: AnalyzeResponse;
};

export function CurrentAnalysisCard({ analysis }: CurrentAnalysisCardProps) {
  return (
    <article className="w-full rounded-2xl border border-blue-500/30 bg-slate-900/80 p-6 shadow-lg shadow-blue-950/20">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-700 pb-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-300">
            Current Match Analysis
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            {analysis.job_title || "Untitled Role"}
          </h2>

          <p className="mt-1 text-slate-300">
            {analysis.company_name || "Unknown Company"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-600 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-300">
              {analysis.application_status}
            </span>

            {analysis.follow_up_date && (
              <span className="rounded-full border border-slate-600 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-300">
                Follow-up:{" "}
                {new Date(`${analysis.follow_up_date}T00:00:00`).toLocaleDateString()}
              </span>
            )}

            {analysis.job_link && (
              <a
                href={analysis.job_link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20 hover:text-blue-200"
              >
                View job posting
              </a>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/40 bg-blue-950/50 px-6 py-4 text-center">
          <p className="text-sm font-medium text-blue-200">Match Score</p>
          <p className="mt-1 text-4xl font-bold text-white">
            {analysis.match_score}%
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          AI Summary
        </p>
        <p className="mt-2 leading-relaxed text-slate-200">{analysis.summary}</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
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

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
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

      {analysis.notes && (
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Notes
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {analysis.notes}
          </p>
        </div>
      )}

      <div className="grid gap-3 border-t border-slate-700 pt-4 text-sm text-slate-400 sm:grid-cols-2">
        <p>
          <span className="font-semibold text-slate-300">Resume length:</span>{" "}
          {analysis.resume_length} characters
        </p>

        <p>
          <span className="font-semibold text-slate-300">
            Job description length:
          </span>{" "}
          {analysis.job_description_length} characters
        </p>
      </div>
    </article>
  );
}