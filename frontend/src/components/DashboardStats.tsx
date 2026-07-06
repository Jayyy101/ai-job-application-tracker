import type { SavedAnalysis } from "@/types/analysis";

type DashboardStatsProps = {
    savedAnalyses: SavedAnalysis[];
};

type ApplicationStatus =
    | "Interested"
    | "Applied"
    | "Interviewing"
    | "Offer"
    | "Rejected";

const statusOptions: ApplicationStatus[] = [
    "Interested",
    "Applied",
    "Interviewing",
    "Offer",
    "Rejected",
];

function getAverageMatchScore(savedAnalyses: SavedAnalysis[]) {
    if (savedAnalyses.length === 0) {
        return 0;
    }

    const totalScore = savedAnalyses.reduce(
        (total, analysis) => total + analysis.match_score,
        0
    );

    return Math.round(totalScore / savedAnalyses.length);
}

function getHighestMatchScore(savedAnalyses: SavedAnalysis[]) {
    if (savedAnalyses.length === 0) {
        return 0;
    }
    
    return Math.max(...savedAnalyses.map((analysis) => analysis.match_score));
}

function getStatusCounts(savedAnalyses: SavedAnalysis[]) {
    const statusCounts: Record<ApplicationStatus, number> = {
        Interested: 0,
        Applied: 0,
        Interviewing: 0,
        Offer: 0,
        Rejected: 0,
    };

    savedAnalyses.forEach((analysis) => {
        const status = analysis.application_status as ApplicationStatus;

        if (status in statusCounts) {
            statusCounts[status] += 1;
        }
    });

    return statusCounts;
}

function isFollowUpDueSoon(followUpDate: string | null) {
    if (!followUpDate) {
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromToday = new Date(today);
    sevenDaysFromToday.setDate(today.getDate() + 7);

    const followUp = new Date(`${followUpDate}T00:00:00`);

    return followUp >= today && followUp <= sevenDaysFromToday;
}

export function DashboardStats({ savedAnalyses }: DashboardStatsProps) {
    const totalSaved = savedAnalyses.length;
    const averageMatchScore = getAverageMatchScore(savedAnalyses);
    const highestMatchScore = getHighestMatchScore(savedAnalyses);
    const statusCounts = getStatusCounts(savedAnalyses);

    const activePipelineCount = 
        statusCounts.Applied + statusCounts.Interviewing + statusCounts.Offer;

    const followUpsDueSoonCount = savedAnalyses.filter((analysis) =>
        isFollowUpDueSoon(analysis.follow_up_date)
    ).length;

    return (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/30">
            <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
                    Dashboard Overview
                </p>

                <h2 className="mt-2 text-2xl font-bold text-white">
                    Application Summary
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                    A quick snapshot of your saved applications, match quality, statuses,
                    and upcoming follow-ups.
                </p>
            </div>

            {totalSaved === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center">
                    <p className="text-lg font-semibold text-white">
                        No dashboard stats yet
                    </p>

                    <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                        Save your first job match analysis to see application stats here.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Total Saved
                            </p>

                            <p className="mt-2 text-3xl font-bold text-white">
                                {totalSaved}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Average Match
                            </p>

                            <p className="mt-2 text-3xl font-bold text-white">
                                {averageMatchScore}%
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Highest Match
                            </p>

                            <p className="mt-2 text-3xl font-bold text-white">
                                {highestMatchScore}%
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Active Pipeline
                            </p>

                            <p className="mt-2 text-3xl font-bold text-white">
                                {activePipelineCount}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                                Applied, interviewing, or offer
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Follow-ups Soon
                            </p>

                            <p className="mt-2 text-3xl font-bold text-white">
                                {followUpsDueSoonCount}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                                Due in the next 7 days
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                        <p className="text-sm font-semibold text-slate-300">
                            Applications by status
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {statusOptions.map((status) => (
                                <div
                                    key={status}
                                    className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                                >
                                    <p className="text-sm font-semibold text-white">{status}</p>

                                    <p className="mt-1 text-2xl font-bold text-blue-300">
                                        {statusCounts[status]}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}