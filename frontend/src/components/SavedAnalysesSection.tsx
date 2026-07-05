"use client";

import { useState } from "react";

import { SavedAnalysisCard } from "@/components/SavedAnalysisCard";
import type { SavedAnalysis } from "@/types/analysis";

type SavedAnalysesSectionProps = {
  savedAnalyses: SavedAnalysis[];
};

type StatusFilter = "All" | "Interested" | "Applied" | "Interviewing" | "Offer" | "Rejected";

type SortOption =
  | "newest"
  | "oldest"
  | "highest-match"
  | "lowest-match"
  | "follow-up-soonest";

const statusOptions: StatusFilter[] = [
  "All",
  "Interested",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
];

const sortOptions = [
  {
    value: "newest",
    label: "Newest saved first",
  },
  {
    value: "oldest",
    label: "Oldest saved first",
  },
  {
    value: "highest-match",
    label: "Highest match score",
  },
  {
    value: "lowest-match",
    label: "Lowest match score",
  },
  {
    value: "follow-up-soonest",
    label: "Follow-up date soonest",
  },
] satisfies { value: SortOption; label: string }[];

function getSearchableText(analysis: SavedAnalysis) {
    const searchableFields = [
        analysis.job_title ?? "",
        analysis.company_name ?? "",
        analysis.application_status,
        analysis.summary,
        analysis.notes ?? "",
        ...analysis.matched_skills,
        ...analysis.missing_skills,
    ];

    return searchableFields.join(" ").toLowerCase();
}

function getFollowUpTime(followUpDate: string | null) {
    if (!followUpDate) {
        return Number.MAX_SAFE_INTEGER;
    }

    return new Date(`${followUpDate}T00:00:00`).getTime();
}

export function SavedAnalysesSection({
  savedAnalyses,
}: SavedAnalysesSectionProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("All");
  const [selectedSort, setSelectedSort] = useState<SortOption>("newest");

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredAndSortedAnalyses = savedAnalyses
    .filter((analysis) => {
      const matchesSearch =
        normalizedSearchQuery === "" ||
        getSearchableText(analysis).includes(normalizedSearchQuery);

      const matchesStatus =
        selectedStatus === "All" ||
        analysis.application_status.toLowerCase() ===
          selectedStatus.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((firstAnalysis, secondAnalysis) => {
      if (selectedSort === "oldest") {
        return (
          new Date(firstAnalysis.created_at).getTime() -
          new Date(secondAnalysis.created_at).getTime()
        );
      }

      if (selectedSort === "highest-match") {
        return secondAnalysis.match_score - firstAnalysis.match_score;
      }

      if (selectedSort === "lowest-match") {
        return firstAnalysis.match_score - secondAnalysis.match_score;
      }

      if (selectedSort === "follow-up-soonest") {
        return (
          getFollowUpTime(firstAnalysis.follow_up_date) -
          getFollowUpTime(secondAnalysis.follow_up_date)
        );
      }

      return (
        new Date(secondAnalysis.created_at).getTime() -
        new Date(firstAnalysis.created_at).getTime()
      );
    });

  const hasActiveFilters =
    searchQuery !== "" || selectedStatus !== "All" || selectedSort !== "newest";

  function clearFilters() {
    setSearchQuery("");
    setSelectedStatus("All");
    setSelectedSort("newest");
  }
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
            Application History
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Saved Analyses
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Review previous resume and job description matches saved in your
            local database.
          </p>
        </div>

        <div className="w-fit rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-300">
          {savedAnalyses.length} saved
        </div>
      </div>

      {savedAnalyses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center">
          <p className="text-lg font-semibold text-white">
            No saved analyses yet
          </p>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
            Submit your first resume and job description match to start building
            your application history.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
              <div>
                <label
                  htmlFor="saved-analysis-search"
                  className="text-sm font-semibold text-slate-300"
                >
                  Search saved analyses
                </label>

                <input
                  id="saved-analysis-search"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by company, role, notes, skills..."
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="saved-analysis-status"
                  className="text-sm font-semibold text-slate-300"
                >
                  Status
                </label>

                <select
                  id="saved-analysis-status"
                  value={selectedStatus}
                  onChange={(event) =>
                    setSelectedStatus(event.target.value as StatusFilter)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === "All" ? "All statuses" : status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="saved-analysis-sort"
                  className="text-sm font-semibold text-slate-300"
                >
                  Sort by
                </label>

                <select
                  id="saved-analysis-sort"
                  value={selectedSort}
                  onChange={(event) =>
                    setSelectedSort(event.target.value as SortOption)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                >
                  {sortOptions.map((sortOption) => (
                    <option key={sortOption.value} value={sortOption.value}>
                      {sortOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-blue-400 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-700 disabled:hover:text-slate-300"
              >
                Clear filters
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-400">
              Showing {filteredAndSortedAnalyses.length} of{" "}
              {savedAnalyses.length} saved analyses
            </p>
          </div>

          {filteredAndSortedAnalyses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center">
              <p className="text-lg font-semibold text-white">
                No matching saved analyses
              </p>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                Try changing your search, status filter, or sort option.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {filteredAndSortedAnalyses.map((analysis) => (
                <SavedAnalysisCard key={analysis.id} analysis={analysis} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}