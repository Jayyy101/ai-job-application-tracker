import type { SuggestedBulletImprovement } from "@/types/analysis";

type SuggestedBulletListProps = {
  suggestions: SuggestedBulletImprovement[];
};

export function SuggestedBulletList({ suggestions }: SuggestedBulletListProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
          Suggested Resume Bullet Improvements
        </p>
        <p className="mt-1 text-sm text-slate-400">
          AI-generated suggestions grounded in the resume and job description.
        </p>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion, index) => (
          <article
            key={`${suggestion.improved_bullet}-${index}`}
            className="rounded-xl border border-slate-700 bg-slate-950/60 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-300">
                {index + 1}
              </span>
              <p className="text-sm font-semibold text-white">
                Resume bullet suggestion
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Original / Source Detail
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">
                  {suggestion.original_bullet_or_source_detail}
                </p>
              </div>

              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  Improved Bullet
                </p>
                <p className="mt-1 text-sm leading-relaxed text-emerald-50">
                  {suggestion.improved_bullet}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Why It Is Better
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    {suggestion.why_it_is_better}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Evidence Used
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    {suggestion.evidence_used}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Honesty Check
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    {suggestion.honesty_check}
                  </p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}