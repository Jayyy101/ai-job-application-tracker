import { SavedAnalysisCard } from "@/components/SavedAnalysisCard";
import type { SavedAnalysis } from "@/types/analysis";

type SavedAnalysesSectionProps = {
  savedAnalyses: SavedAnalysis[];
};

export function SavedAnalysesSection({
  savedAnalyses,
}: SavedAnalysesSectionProps) {
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
        <div className="grid gap-5">
          {savedAnalyses.map((analysis) => (
            <SavedAnalysisCard key={analysis.id} analysis={analysis} />
          ))}
        </div>
      )}
    </section>
  );
}