import Link from "next/link";
import LegacyAnalysis from "@/baseline/LegacyAnalysis";

export default function BaselinePage() {
  // An opt-in is required so the development preview cannot silently reach the old API.
  if (process.env.NEXT_PUBLIC_ENABLE_BASELINE === "true" && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return <LegacyAnalysis />;
  }
  return <main className="page-content"><Link className="back-link" href="/">← Back to tracker</Link><div className="panel detail-panel"><h1 className="form-section-title">Original analysis baseline</h1><p className="body-copy">The original analysis interface, prompts, schemas, and backend are preserved for later comparisons. Live baseline requests are disabled in this development preview.</p><p className="body-copy">No model comparison or measured quality improvement is claimed. The README explains how the preserved baseline is separated from the new tracker.</p></div></main>;
}
