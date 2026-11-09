# Core workflow checkpoint

Updated on November 7, 2026 (America/Los_Angeles). Changes remain uncommitted. No dependencies were upgraded; no paid requests were made.

| Check | Result |
| --- | --- |
| Backend unittest suite | 53 passed, isolated databases; outbound sockets blocked |
| Browser workflow | 63 passed, temporary database, mock provider, extension-free Chrome |
| Evaluation harness | 5 contract tests passed; 12 fixture integrity checks passed |
| Export contracts | 5 tests passed: Unicode, multiline fields, formula escaping, allowlist, filenames |
| Fresh-source backend | 51 tests passed without saved databases or .env files, using installed dependencies |
| GitHub Actions | Added; hosted execution and clean Linux dependency installation not yet verified |
| ESLint | Passed |
| TypeScript | Passed (`tsc --noEmit --incremental false`) |
| Production build | Passed (`npm run build`, Node 24, standard Turbopack) |
| Whitespace check | `git diff --check` passed |
| Original saved database and backend | Content fingerprints unchanged |
| Original analysis frontend | Preserved copy matches tracked frontend at Git HEAD `7219205` |
| Live OpenAI integration | Implemented, SDK contract mocked; **not exercised live** |
| Model evaluation results | **0 live model runs**; no quality/performance improvement measured |

The browser checks cover create/edit/archive/restore, filters, preserved inputs after errors, no review on page load, document save failures, lost review responses, exact source navigation and focus, clarification recovery, accept/reject/edit history, retry-safe version creation, reopened results, mobile page overflow, and the separate unsaved demo. No runtime exceptions or hydration warnings occurred in the clean browser. No hydration suppression was added.

Backend tests additionally cover immutable storage triggers, Unicode source offsets, cross-application references, invalid citations and fabricated numbers, duplicate concurrent requests, unknown provider outcomes, restart recovery, configuration/refusal errors, and preserved provenance on failures. Exact quotes and valid schemas do not prove semantic accuracy.

Legacy import was rehearsed with synthetic source copies and a disposable destination, including rollback and restoration to a new file from backup. A separate rehearsal copied the real saved database, verified counts/mappings and repeat import behavior, and checked unchanged original bytes. Its private temporary copies were removed. It did not import into the development database or original file.

The browser artifacts are synthetic. Selected screenshots are saved under `docs/screenshots/core-workflow/`. The local preview retains existing applications, documents and failed reviews, including **Portfolio Example · synthetic**. Recordings use additional isolated databases rather than the user’s manual walkthrough. It uses `backend/.local/tracker-development.sqlite3`; real provider mode is disabled.

Remaining limits: single-worker local service, plaintext local SQLite, no public authentication or document deletion/retention workflow, no PDF/DOCX parsing, and no measured semantic model quality. The fixed mock accepts its two synthetic texts with harmless paste whitespace; different claims still fail. Human confirmation records a decision; it is not a factual guarantee.

The final focused pass adds transactional activity, scoped CSV exports, résumé text downloads, and CI. See [the implementation review](final-focused-review.md) for confirmed defects, targeted regressions and limitations. Browser checks ran through `scripts/ci-browser.mjs` against a temporary production frontend, with its own synthetic backend and database.

The November 7 clarity pass and actual MP4 recordings are documented in [the recorded walkthrough](recorded-walkthrough.md). The saved mock failure caused by trailing whitespace was reproduced and fixed without rewriting its source versions or failure history. New regressions cover formatting-tolerant mocks, exact original citations, new-record history completeness, visible labels, singular counts, follow-up limits, saved-review hierarchy and mock billing language.
