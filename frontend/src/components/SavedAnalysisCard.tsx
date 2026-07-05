"use client";

import { useState } from "react";

import { FeedbackList } from "@/components/FeedbackList";
import { SkillTagList } from "@/components/SkillTagList";
import { SuggestedBulletList } from "./SuggestedBulletList";
import type { SavedAnalysis, UpdateAnalysisRequest } from "@/types/analysis";

type SavedAnalysisCardProps = {
  analysis: SavedAnalysis;
  onUpdateAnalysis: (
    analysisId: number,
    updates: UpdateAnalysisRequest
  ) => Promise<SavedAnalysis>;
  onDeleteAnalysis: (analysisId: number) => Promise<void>;
};

const applicationStatusOptions = [
  "Interested",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
];

function createEditFormFromAnalysis(
  analysis: SavedAnalysis
): UpdateAnalysisRequest {
  return {
    company_name: analysis.company_name ?? "",
    job_title: analysis.job_title ?? "",
    job_link: analysis.job_link ?? "",
    application_status: analysis.application_status,
    notes: analysis.notes ?? "",
    follow_up_date: analysis.follow_up_date,
  };
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

function formatFollowUpDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString();
}

function createSummaryPreview(summary: string) {
  if (summary.length <= 180) {
    return summary;
  }

  return `${summary.slice(0, 180)}...`;
}

export function SavedAnalysisCard({
  analysis,
  onUpdateAnalysis,
  onDeleteAnalysis,
}: SavedAnalysisCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editForm, setEditForm] = useState<UpdateAnalysisRequest>(() =>
    createEditFormFromAnalysis(analysis)
  );

  const summaryPreview = createSummaryPreview(analysis.summary);

  function updateEditForm(
    fieldName: keyof UpdateAnalysisRequest,
    value: string | null
  ) {
    setEditForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }));
  }

  function cancelEditing() {
    setEditForm(createEditFormFromAnalysis(analysis));
    setIsEditing(false);
  }

  async function saveEdits() {
    setIsSaving(true);

    try {
      const updatedAnalysis = await onUpdateAnalysis(analysis.id, {
        ...editForm,
        follow_up_date: editForm.follow_up_date || null,
      });

      setEditForm(createEditFormFromAnalysis(updatedAnalysis));
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAnalysis() {
    const confirmed = window.confirm(
      "Delete this saved application? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      await onDeleteAnalysis(analysis.id);
    } finally {
      setIsDeleting(false);
    }
  }

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

        <div className="flex shrink-0 flex-col gap-3 lg:items-end lg:text-right">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Match Score
            </p>

            <p className="mt-1 text-3xl font-bold text-blue-400">
              {analysis.match_score}%
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsEditing((currentValue) => !currentValue)}
              disabled={isSaving || isDeleting}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-400 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isEditing ? "Close edit" : "Edit"}
            </button>

            <button
              type="button"
              onClick={deleteAnalysis}
              disabled={isSaving || isDeleting}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="mb-5 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold text-blue-200">
              Edit saved application
            </p>

            <p className="mt-1 text-xs text-slate-400">
              These changes update the saved application details only. The AI
              analysis will stay the same.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-300">
                Company Name
              </label>

              <input
                type="text"
                value={editForm.company_name}
                onChange={(event) =>
                  updateEditForm("company_name", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-300">
                Job Title
              </label>

              <input
                type="text"
                value={editForm.job_title}
                onChange={(event) =>
                  updateEditForm("job_title", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-300">
                Job Link
              </label>

              <input
                type="url"
                value={editForm.job_link}
                onChange={(event) =>
                  updateEditForm("job_link", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-300">
                Application Status
              </label>

              <select
                value={editForm.application_status}
                onChange={(event) =>
                  updateEditForm("application_status", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              >
                {applicationStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-300">
                Follow-up Date
              </label>

              <input
                type="date"
                value={editForm.follow_up_date ?? ""}
                onChange={(event) =>
                  updateEditForm(
                    "follow_up_date",
                    event.target.value === "" ? null : event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-300">
                Notes
              </label>

              <textarea
                value={editForm.notes}
                onChange={(event) =>
                  updateEditForm("notes", event.target.value)
                }
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={saveEdits}
              disabled={isSaving}
              className="rounded-xl border border-blue-500 bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save edits"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI Summary
        </p>

        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {isExpanded ? analysis.summary : summaryPreview}
        </p>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Saved {formatDate(analysis.created_at)}
          </p>

          <button
            type="button"
            onClick={() => setIsExpanded((currentValue) => !currentValue)}
            className="w-fit rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:border-blue-400 hover:bg-blue-500/20 hover:text-blue-200"
          >
            {isExpanded ? "Hide details" : "Show full analysis"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
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

          <SuggestedBulletList
            suggestions={analysis.suggested_bullet_improvements}
          />

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
        </>
      )}
    </article>
  );
}