# Final focused implementation review

Scope: activity history, useful exports, CI, and reliability corrections in the existing local Jobfolio workflow. No redesign, dependency upgrade, paid provider request, commit, push, or deployment. Original analysis code and saved database remain protected.

## Added behavior and decisions

- **Activity:** an append-only table records new status/archive/restore transitions in the same transaction as the tracking edit. Creation, documents, review requests/outcomes, and applied versions reuse their existing persisted records. Stable source-based event IDs prevent duplicated derived entries. Applying revisions appears once, not once as an application and again as a document save. Newest-first details show eight entries initially, with expansion and source links. Unknown pre-existing status/restore history is explicitly absent. Interruption times are labeled as detection times, not fabricated provider completion times.
- **Exports:** CSV is generated from an allowlist of the loaded application fields. Filtered scope preserves displayed filtering/sorting and current/archived scope; all-record scope includes archived records and ignores those filters. Unicode and multiline fields are preserved with UTF-8 BOM and standard quoted CSV. Formula-like cells get a protective apostrophe, with the tradeoff disclosed. Résumé TXT exports use the exact selected immutable version, without metadata or AI payloads.
- **CI:** two GitHub Actions jobs use Python 3.11 and Node 24, existing dependency manifests, no private data/API secrets, and read-only repository permissions. The browser entry point starts a temporary production frontend on a free port; the suite creates its own mocked backend, database and Chrome profile. Only synthetic PNGs, results and frontend logs are eligible for artifacts.

## Confirmed defects corrected

| Finding from actual implementation | Correction | Regression evidence |
| --- | --- | --- |
| Archive always replaced `archived_at` and `updated_at`, including a repeated request. Late tracking retries could overwrite a newer status or restore. | No-op transitions preserve timestamps. A stable `X-Request-ID` receipt prevents a replay from changing newer state; mismatched reuse returns 409. | Repeated archive, late status retry after a newer status, late archive retry after restore, receipt mismatch, concurrent archive requests. |
| Mutable state was read before reserving the SQLite writer. An apply request could validate an old accepted decision while a rejection was waiting to commit. Duplicate document/event inserts could also produce unnecessary constraint failures. | Short POST/PUT transactions use `BEGIN IMMEDIATE` before reads, serializing state checks and writes. Provider waits hold no write lock. | Hold an uncommitted rejection in one connection, submit apply concurrently, commit rejection: apply waits then returns 409 and creates no document. Concurrent document and decision replays return the original record once. |
| The server chose the provider from its current environment without comparing it with what the open browser had acknowledged. | New review requests carry expected mode/model. Configuration changes return 409 before saving a new run or calling a provider. | A request acknowledged in mock mode is rejected after switching test configuration to OpenAI; the mocked provider is never invoked. |
| A final database-write failure after provider completion escaped the worker and could leave a run “running” indefinitely until restart. | Attempt to save an uncertainty marker without repeating the provider call. Reads recover unfinished requests past the three-minute completion window; late workers cannot overwrite that marker. | Inject a failed success-result commit, verify uncertainty and one provider invocation across retry. Age an orphaned run, recover via GET, and reject a simulated late completion. |
| Whitespace-only quotes could pass substring checks; blank/unusable suggestion IDs could pass the model schema but could not be saved through event APIs. | Require meaningful nonblank quotes and bounded, usable output IDs; quarantine invalid structured output. | Mock response with blank quote/ID becomes `invalid_output`, with no visible result or applicable decision. Existing wrong-document, fabricated-quote, invented-number and overlapping-revision tests remain. |
| Reopening an older review selected the newest résumé in the request controls, even though the displayed review used its original version. A history switch could retain consent for different answers/inputs. | Initial/history selection uses the chosen run’s original document IDs and resets consent/answer inclusion when changing reviews. | Browser creates a revised résumé, reopens the original review and verifies both original selectors, evidence and saved decisions. |
| The document form unmounted during refresh after saving, dropping its success message and keyboard focus. Activity would also remain stale after document saves. | Keep the save announcement in the parent, focus the saved version summary, and refresh the activity panel after a successful save. | Browser asserts the announcement/focus, input preservation on failure, and persisted document history. |
| Imported whitespace-only company/role names passed the importer but failed current API validation when listed. Immutable-history triggers were only installed by API startup. | Normalize display names to honest placeholders while preserving raw originals; initialize immutable triggers consistently in seeds/imports/API. | Import whitespace names and read them through the API; raw strings remain intact. Direct SQL mutation of an imported document fails even before starting the API. |

## Reviewed invariants and boundaries

- Source versions retain their original text, Unicode offsets and passage IDs. There are no update/delete endpoints for documents, and SQLite triggers reject direct mutation. Existing review references are not rewritten when applying revisions.
- Every displayed citation must resolve to its selected document/passage and exact source substring. Revision sources must match a full passage. Invalid output is quarantined; there is no success-shaped keyword or synthetic fallback. These checks do **not** prove semantic relevance or truth.
- Saved review fingerprints and request IDs still deduplicate repeated/concurrent submissions. A timeout or interrupted operation never silently triggers another provider request. A deliberate live-provider retry acknowledges a potentially repeated charge; mock failures explicitly state that no provider call or charge occurred.
- Revision decisions remain append-only. Application of a saved decision set is idempotent; outdated decisions return conflict unless that exact set was already applied, in which case its existing immutable version is returned.
- Mock mode accepts the fixed synthetic texts with harmless paste whitespace, is visibly labeled, has no model usage, and never calls OpenAI. The live adapter remains unverified against a paid provider. Automated live-adapter checks use mocked SDK responses/errors and block outbound sockets.
- Form failures preserve current-page inputs. Evidence links move focus to the source, forms have labels, archive dialogs support Escape, and mobile checks detect page overflow. These checks are not a full accessibility audit.
- Legacy import still preserves source IDs/raw content, does not merge suspected duplicates, skips unchanged repeat imports, aborts changed duplicates atomically, and has rehearsed rollback/backup recovery. Import copy tests never require the user's saved database.

## Remaining limitations and potential concerns

These are not claims of newly observed model failures:

- Valid quotes may be semantically irrelevant, omit negation, misclassify experience, or accompany unsupported nonnumeric wording. The draft evaluation set and human review process address those questions; no model accuracy improvement has been measured.
- The local worker is not a durable distributed queue. Persistent storage failure may delay uncertainty detection until a later read; a provider charge can remain unknown. Recovery favors avoiding duplicate calls over automatic completion.
- Serializing SQLite writes is suitable for this local, single-worker app but limits write concurrency. Separate tracking edits still use last-write-wins; no collaborative edit conflict UI is claimed.
- The UI loads local lists/history in memory. Large-data pagination, deletion/retention, authentication, encrypted storage, public hosting and PDF/DOCX parsing remain outside scope.
- Spreadsheet programs vary in how they preserve escaping when saving/reopening CSV. Dangerous cells are deliberately prefixed; users should import untrusted columns as text. CSV exports do not mutate the saved record. TXT exports are exact.
- GitHub-hosted execution, Linux dependency installation, runner Chrome behavior and artifact upload remain unverified until this uncommitted workflow runs on GitHub. No push was performed to trigger it. Local production-browser execution is a separate, explicitly reported check.

## Final local verification

- 51 backend tests passed, including the targeted regressions above.
- The same 51 tests passed in a clean source copy with no private database or `.env` files, using the existing installed dependencies.
- 56 browser checks passed through the CI entry point against a temporary production frontend and isolated mocked backend/database.
- 5 CSV/filename tests, 5 evaluation-harness tests, and all 12 synthetic fixture checks passed.
- ESLint, generated route types, TypeScript, standard production build, and `git diff --check` passed.
- No runtime exceptions or hydration warnings occurred in extension-free Chrome. Expected CDP request cancellations during navigation are reported separately from application exceptions.
- Original database/backend content fingerprints and the original frontend’s Git-history comparison remained unchanged. Dependency manifests/lock versions were not upgraded.

Synthetic screenshots: [export scope](screenshots/final-pass/01-export-scope.png), [desktop activity](screenshots/final-pass/02-activity-timeline.png), [mobile activity](screenshots/final-pass/03-mobile-activity.png).

For the subsequent clarity pass, mock formatting blocker, preserved manual data and before/after MP4s, see [the recorded walkthrough](recorded-walkthrough.md).
