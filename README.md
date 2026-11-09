# Jobfolio · AI Job Application Tracker

A local application tracker with evidence-linked résumé coaching. Save an application with **company and role only**. Reviews, document versions, and wording decisions stay attached to that application rather than creating duplicate applications.

Built with Next.js, React, TypeScript, Tailwind, FastAPI, Pydantic, SQLAlchemy, SQLite, and the existing OpenAI Python SDK. No dependencies were added or upgraded for the connected workflow or final focused pass.

## Implemented and verified boundaries

- Focused dashboard, compact searchable/filterable/sortable application list, details, follow-ups, edit, archive, and restore. Counts represent applications.
- Compact persisted activity timeline: creation, newly recorded status/archive/restore changes, saved versions, review requests/outcomes, and applied revisions. Earlier unrecorded status changes are explicitly unavailable.
- CSV exports of the filtered current/archived view or all applications, plus exact plain-text downloads of selected résumé versions.
- Immutable pasted résumé versions and job snapshots, parent-version lineage, content hashes, stable passage IDs, and exact Unicode offsets.
- Persistent review runs, required/preferred/unspecified requirements, support assessments, source evidence, clarification answers, and append-only accept/edit/reject decisions.
- Applying accepted decisions creates another résumé version. Older documents and reviews retain their original inputs. Applying the same decisions again returns the existing version.
- Real server-side OpenAI Responses integration with structured output, source validation, provenance and available usage. **Live integration has not been exercised; no paid calls or model comparisons were made.**
- A fixed synthetic mock provider for exercising persistence, and a separate hand-authored demo at `/review`. Neither is evidence of model quality.
- Explicit legacy-copy import with dry run, repeat-import detection, transaction rollback, and a backup procedure. Existing saved data has not been migrated.
- GitHub Actions for isolated backend/evaluation tests, export tests, frontend lint/type/build, and the production-browser suite. Hosted execution remains unverified until the workflow is run on GitHub.
- Isolated API/browser tests and an offline evaluation harness. Evaluation expectations remain drafts, with zero measured model runs.

**Not included:** PDF/DOCX parsing, public hosting/authentication, multi-user ownership, automatic document deletion/retention, model comparisons, or calibrated fit scores. No ATS scores or hiring probabilities are presented by the new review flow.

Screenshots: [dashboard](docs/screenshots/milestone-1/01-dashboard.png), [compact list](docs/screenshots/milestone-1/02-applications.png), [saved evidence review](docs/screenshots/core-workflow/09-saved-review.png), [revision decisions](docs/screenshots/core-workflow/10-saved-decisions.png), [mobile review](docs/screenshots/core-workflow/11-mobile-saved-review.png). All show synthetic data. Final-pass screens: [export scope](docs/screenshots/final-pass/01-export-scope.png), [activity timeline](docs/screenshots/final-pass/02-activity-timeline.png), [mobile activity](docs/screenshots/final-pass/03-mobile-activity.png).

## Windows PowerShell: fresh checkout and startup

Install **Git for Windows**, **Node.js 24** (with npm), and **Python 3.11** (with the `py` launcher). Chrome is needed only for browser checks or recording. Conda, WSL, a private database and API keys are not required. Use a local writable folder; commands below assume a normal Windows Python installation.

From the folder where you keep projects, run once:

```powershell
git clone https://github.com/Jayyy101/ai-job-application-tracker.git
Set-Location ai-job-application-tracker
git switch main
py -3.11 -m venv .venv
$env:PYTHONUTF8 = "1"
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Set-Location frontend
npm.cmd ci
Set-Location ..
```

Use the virtual environment's executable directly; no activation or execution-policy change is necessary. `npm.cmd` / `npx.cmd` also avoid PowerShell's script-execution-policy restriction on `npm.ps1`. Dependency versions are preserved; `uvloop` is excluded on Windows and Uvicorn uses the standard asyncio loop there.

**Terminal 1 — backend**, starting in the cloned repository root:

```powershell
$env:PYTHONUTF8 = "1"
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
$TrackerDatabase = Join-Path (Get-Location).Path "backend\.local\tracker-development.sqlite3"
.\.venv\Scripts\python.exe -B backend\run_tracker.py --database "$TrackerDatabase" --seed-demo --seed-review-demo --review-mode mock --port 43128 --frontend-origin "http://127.0.0.1:43127"
```

The absolute database path is explicit. Its parent directory and schema are created automatically. The original `backend/job_tracker.db` is protected and is **not** part of the checkout. Seeds create synthetic tracking records plus **Portfolio Example · synthetic** and its original mock input versions; they do not replace existing records. Mock mode never calls a provider. Omit both seed flags for an empty workspace.

**Terminal 2 — frontend**, starting in the same repository root:

```powershell
Set-Location frontend
$env:NEXT_PUBLIC_TRACKER_API_URL = "http://127.0.0.1:43128"
$env:NEXT_PUBLIC_ENABLE_BASELINE = "false"
npm.cmd run dev -- --hostname 127.0.0.1 --port 43127
```

Open **http://127.0.0.1:43127**; backend health is **http://127.0.0.1:43128/health**. Leave both terminals running. Stop only these servers with Ctrl+C in their terminals. If a port is occupied, choose free ports and update backend `--port` / `--frontend-origin` and frontend `NEXT_PUBLIC_TRACKER_API_URL` / `--port` together. Do not stop an unrelated process. Frontend public variables are read at dev startup/build time; restart or rebuild after changing them.

### Windows checks

From the repository root, with dependencies already installed:

```powershell
$env:PYTHONUTF8 = "1"
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
$env:TRACKER_REVIEW_MODE = "mock"
$env:TRACKER_TEST_PYTHON = (Resolve-Path ".venv\Scripts\python.exe").Path
Push-Location backend
& $env:TRACKER_TEST_PYTHON -B -m unittest discover -s tests -v
Pop-Location
& $env:TRACKER_TEST_PYTHON -B -m unittest discover -s evaluation -v
& $env:TRACKER_TEST_PYTHON -B evaluation\validate_cases.py
node --test scripts\export-check.test.mjs
Push-Location frontend
$env:NEXT_PUBLIC_TRACKER_API_URL = "http://127.0.0.1:43128"
$env:NEXT_PUBLIC_ENABLE_BASELINE = "false"
npm.cmd run lint
npx.cmd --no-install next typegen
npm.cmd run typecheck
npm.cmd run build
Pop-Location
# Requires Chrome; starts and stops its own production frontend + mock backend.
node scripts\ci-browser.mjs
```

Chrome discovery supports its standard Windows installation locations. For a custom installation set `$env:TRACKER_CHROME_PATH` to the absolute `chrome.exe` path. Browser tests use separate temporary databases/profiles, even if your preview is running. The symlink-specific backend test may skip when Windows does not grant symlink privileges; direct-path database protection still runs. Test fixtures close SQLite handles explicitly so Windows can remove their temporary files.

### Configuration names and portability

| Name | Purpose / safe setup |
| --- | --- |
| `NEXT_PUBLIC_TRACKER_API_URL` | Required frontend tracker URL; use the loopback backend URL above. |
| `NEXT_PUBLIC_ENABLE_BASELINE` | Keep `false`; the historical analysis interface stays disabled. |
| `TRACKER_DATABASE_PATH` | Backend absolute path, set by the required `--database` option. |
| `TRACKER_FRONTEND_ORIGIN` | Backend CORS origin, set by `--frontend-origin`. |
| `TRACKER_REVIEW_MODE` | Backend mode; the startup CLI sets it from `--review-mode mock` (default is disabled). |
| `PYTHONUTF8` | Use `1` for consistent UTF-8 fixture/document file handling across platforms. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional server-only **live** settings; neither is needed for mock mode. Do not set a key or enable live mode for this handoff. |
| `NEXT_PUBLIC_API_BASE_URL`, `FRONTEND_ORIGIN` | Historical baseline settings only; leave unused for this tracker. |
| `TRACKER_TEST_PYTHON`, `TRACKER_CHROME_PATH` | Optional browser-check executable overrides. |
| `TRACKER_PREVIEW_URL`, `TRACKER_PREVIEW_API`, `TRACKER_ARTIFACTS_PARENT` | Optional test/recording addresses and artifact directory. |
| `TRACKER_FFMPEG`, `RECORDING_LABEL` | Optional recorder encoder executable and unique output label. |
| `NEXT_DIST_DIR` | Optional Next.js output override; normally leave unset. |

No `.env` file is necessary for these commands. Only placeholder `.env.example` templates are published. Never put provider credentials in a `NEXT_PUBLIC_` variable.

The macOS/Linux examples below use POSIX shell syntax (`source`, `$PWD`, `VAR=value command`) and are **not PowerShell commands**. The Mac's Conda environment, `/Users/...` paths, `nvm use` shell command, existing MP4 players and temporary encoder installation do not transfer. Repository Node browser scripts now discover Windows Chrome; the recorder additionally needs an independently installed FFmpeg and uses the same override variables. The one-off Mac playback-verification helper is not a repository script. Desktop/browser/recording behavior on an actual Windows PC remains unverified until exercised there; CI backend results are reported separately in the handoff.

Git transfers source, the preserved analysis baseline, synthetic fixtures, documentation, small synthetic screenshots and checks. **Mac-only local state:** original/development databases (including your walkthrough and failed-review history), `.env` files, dependencies/virtual environments, build outputs, exports, browser profiles and videos under `artifacts/walkthrough/`. Those remain untouched on the Mac and do not appear after cloning. Do not copy private databases or résumé files into Git to transfer them; a fresh Windows workspace starts from synthetic seeds.

## macOS / Linux: local synthetic walkthrough

Use Node 24 (`.nvmrc`) and Python 3.11 (`.python-version`) with the existing installed packages. From the repository root:

```sh
conda activate ai-job-tracker-backend
python -B backend/run_tracker.py \
  --database "$PWD/backend/.local/tracker-development.sqlite3" \
  --seed-demo --seed-review-demo --review-mode mock
```

In another terminal:

```sh
cd frontend
nvm use
NEXT_PUBLIC_TRACKER_API_URL=http://127.0.0.1:43128 npm run dev -- --hostname 127.0.0.1 --port 43127
```

Open **http://127.0.0.1:43127**. The backend binds to `127.0.0.1:43128`. For different available ports, use backend `--port` and `--frontend-origin`, and match the frontend API URL and `--port`. Do not stop an unrelated service to free a port.

`--seed-demo` adds six synthetic tracking records only to an empty database. `--seed-review-demo` independently adds one clearly named **Portfolio Example · synthetic** application with two original documents if that application does not exist. Neither replaces saved records. The fixed mock accepts those synthetic texts with harmless paste whitespace (blank lines, indentation, CRLF or trailing newlines). Other content produces an explicit failure, never a fabricated analysis. Citations always use the exact saved text; documents are not normalized or rewritten. The mock ignores supplied clarification answers when composing its fixed response, but records their input provenance.

Omit the seed options for an empty workspace. Omit `--review-mode` to disable reviews. No key is needed for tracking, documents, the demo, or mock reviews.

### One consolidated walkthrough

Prefer watching? See the [before/after recorded walkthrough and timestamp index](docs/recorded-walkthrough.md). These are real local browser sessions using separate synthetic databases, with no paid calls.

All examples below are synthetic. The local preview uses **mock mode**; no live provider is needed.

1. Open the dashboard and Applications. Save **Walkthrough Co · synthetic** / **Frontend Developer** with no other fields. Expect one new application, with no analysis request.
2. Open **Edit details**. Set status to **Applied**, a next step and a follow-up date. Save changes, archive it, then restore it from the archived list. The **Activity** timeline shows the actual status/archive/restore events, newest first. Existing older applications do not receive invented past transitions.
3. In **Add or revise pasted text**, save two documents with names such as “Original résumé” and “Original job”. Use the mock texts below (paste whitespace is allowed). Each save creates a version, announces success, focuses the saved version, and refreshes activity. Saving never sends anything to AI.
4. Open the review workspace. Select those two versions, acknowledge mock mode, and click **Request mock review**. Expect a saved **synthetic mock result**. Repeated requests for identical inputs reuse the run. **Check saved request**, shown while waiting or after a request error, only retrieves status and cannot send a provider request. A known failed mock shows **Start a new attempt** after you acknowledge the request; the failed run stays in history and incurred no provider charge.
5. Expand requirements and select evidence quotes. Their exact source passages highlight. The project supports React/TypeScript interface work; it does not establish two years of professional employment. “Not evidenced” is about this résumé text, not the applicant’s ability.
6. Answer the clarification with **I did not measure usability outcomes.** Save it. It remains a labeled user-supplied claim; the existing assessment is not silently changed. The fixed mock does not generate personalized responses from that answer.
7. Confirm the facts and accept the proposed wording, or open **Edit the suggestion yourself** / reject it. Previous decisions remain in history. **Apply accepted revisions as new version** creates a new résumé version based on this review’s original. Retrying the same application of decisions returns that version.
8. Return to application details. Inspect **Activity**, **Saved versions**, and **Previous reviews**. Download the original and revised résumés using **Download résumé text**. Expect different files containing only each selected version’s exact text. Reopen the review: its selectors and evidence point to its original inputs, not a newer résumé.
9. In Applications, search for your synthetic company and export **Filtered current view**. Expect only the matching visible records, in the displayed order. Archive that record and export the archived view to see the separate scope. Choose **All applications, including archived** to ignore filters and export both scopes. The control and filename identify the chosen scope.
10. Visit `/review` for the separate **hand-authored, unsaved demo**. The real OpenAI adapter is implemented but remains **unverified live**. Legacy import is a separate explicit CLI procedure below, with rehearsals against copies; it never runs from the walkthrough.

<details>
<summary>Synthetic texts accepted by the mock provider</summary>

Résumé:

```text
University project
Built a React and TypeScript course planner with labeled forms and keyboard navigation.
Wrote Python scripts to clean sample datasets.
```

Job description:

```text
Required: React and TypeScript interface development.
Required: two years of professional software development.
Preferred: Docker experience.
Accessible forms and keyboard navigation.
```

You can also use the prepared **Portfolio Example · synthetic** application, which already has these original versions and may have a saved mock review. Changing their content is allowed, but the fixed mock explicitly refuses to invent a result for different claims. Harmless paste whitespace is accepted.

</details>

### Export scope and format

CSV exports use the application data currently loaded in the list. **Filtered view** respects search, status, current/archived scope, and displayed sorting. **All applications** ignores those controls and includes archived records, ordered as returned by the list API. Empty exports still contain column headers. Filenames include the scope and local date.

The allowlisted columns are application ID, company, role, status, posting URL/draft, notes, next action, follow-up date, archive time, creation time and update time. No résumé versions, model output, provider request/response payloads, credentials, or environment configuration are exported. UTF-8 with a BOM and quoted CSV cells preserves Unicode, quotes, commas, and multiline notes.

Formula-like cells (including leading whitespace/control characters and full-width operators) receive a protective apostrophe. This intentionally changes the exported cell, not the saved data. Quoting alone is insufficient. Spreadsheet behavior varies, especially after saving/reopening a CSV; import untrusted columns as text and do not enable formulas. See [OWASP’s CSV guidance](https://owasp.org/www-community/attacks/CSV_Injection). Plain-text résumé downloads are exact UTF-8 source text with no spreadsheet transformation, metadata, or provider payload.

## Real provider configuration (optional; costs money)

The default model remains `gpt-5.4-mini`, matching the existing baseline configuration. `OPENAI_MODEL` can select an accessible model supporting the structured Responses interface; account/model compatibility has not been verified live. No provider switch or model upgrade is implied.

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the **server environment**, or use an explicit `--env-file` pointing to your existing server-only configuration. Never put a secret in `NEXT_PUBLIC_*` variables. The runner does not automatically read `.env` files.

```sh
python -B backend/run_tracker.py \
  --database "$PWD/backend/.local/tracker-development.sqlite3" \
  --review-mode openai --env-file "$PWD/backend/.env"
```

Only an explicit, acknowledged **Request AI review** action sends selected document passages and chosen answers. Saving an application/document or loading a page never calls the provider. The SDK uses `max_retries=0`, a 90-second timeout, bounded output, no tools, and `store=False`. This storage option does **not** make requests local or guarantee zero provider retention; see [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). Implementation follows [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and the [Responses API](https://developers.openai.com/api/reference/python/resources/responses/methods/create).

A review request is saved before execution. A unique input/configuration fingerprint and stable request ID prevent repeated clicks/retries from generating duplicate calls. The UI polls saved status. Requests carry the mode/model the user acknowledged; a configuration mismatch is rejected before any new provider call. Timed-out, interrupted, expired (three-minute completion window), or unsaved provider outcomes become **uncertain**, are never automatically replayed, and may already have incurred a charge. A deliberate new attempt requires acknowledgment. A late worker cannot overwrite an uncertainty marker. Different input versions or selected answers constitute a new request. This is a single-worker local service; do not run multiple backend workers against the same development file.

Invalid source references or quoted text quarantine the output. No invalid citation is displayed as checked, and no keyword or synthetic fallback is substituted. Code also checks required evidence, reference uniqueness, revision overlap, and new numeric tokens. **These checks do not establish semantic truth.** Real-wording improvements may still misinterpret context, introduce nonnumeric claims, or omit requirements. Human review remains necessary; user confirmation is a recorded decision, not proof of accuracy.

## Data and architecture

```text
Application (stable UUID)
 ├─ DocumentVersion (resume/job; immutable text, hash, passages, parent version)
 ├─ ReviewRun (exact document IDs + frozen selected answers + result/provenance)
 │   ├─ ReviewEvent (append-only clarification answers and wording decisions)
 │   └─ RevisionApplication (decision IDs → newly created résumé version)
 ├─ ActivityEvent (new status/archive/restore transitions; append-only)
 ├─ MutationReceipt (retry identity for tracking changes)
 └─ LegacyImport (original ID, source namespace, preserved raw record)
```

New applications record a transactional creation marker so they do not show a missing-history warning. Older records without that marker retain an optional history explanation; no past transitions are invented or backfilled.

The new tables are additive in the explicitly selected development file; existing application rows are not rewritten. SQLite triggers reject updates/deletions of documents and history events. Application tracking fields remain editable. Short writes reserve the SQLite writer before reading mutable state, so concurrent retries and decision/application checks see committed state. No provider wait holds this write lock. Tracking retry receipts prevent a late replay from undoing a newer action. Independent tracking edits still use last-write-wins; this is not a collaborative editor. The optional tracking-form job description is an **editable draft**; copying it into the documents panel explicitly creates an immutable review input. No automatic migration occurs.

Each nonblank line becomes a stable passage in its version. Line formatting is retained exactly, including Unicode offsets; each new version has its own passage IDs. Requirement assessments live in the immutable completed review payload with stable IDs scoped to that run. Model responses record requested/returned model, prompt text hash and version, schema version, input IDs, timestamps, response ID, elapsed time and usage when available. Missing provenance remains null; costs are not guessed.

The provider boundary is separate from storage and source validation. Background execution uses FastAPI’s local process after a durable request record, not a separate queue service. On startup, unfinished runs become uncertain rather than risking replay. Reads also recover stale unfinished runs; result-storage errors attempt to save an uncertainty marker without repeating a provider call. That is deliberately simpler than adding Redis/worker infrastructure for a local portfolio app. List/workspace APIs currently load all local records; pagination is future work.

### Database and privacy boundaries

- `tracker.api:create_app` never imports the legacy `app.main:app` or opens its database.
- Absolute database selection is required. `backend/job_tracker.db`, aliases/symlinks/hardlinks to it, and databases containing legacy `analyses` tables are rejected as tracker destinations.
- `backend/.local/` is ignored. Documents/results are local plaintext in SQLite, not encrypted. Protect the machine and any backups; use synthetic data for demos. Server errors omit request content and secrets.
- Local storage in the browser holds pending request IDs and document/event IDs, not résumé text or API keys. Unsaved form text is preserved during failures in the current page, not across closing the tab.
- No authentication or ownership enforcement is implemented. Keep loopback binding. Public hosting needs access control, retention/deletion, encrypted transport, quotas, rate limits, and an intentional privacy policy.
- Dev/build caches are separate (`.next-preview`, `.next-build`), preserving the original `.next` cache. Fonts are local; builds need no font downloads.

## Explicit legacy-copy import

The original backend/UI remain recoverable from Git commit `72192053a961ce47410bfd0f0b358ae46f83368c`. `backend/app/` is unchanged; `frontend/src/baseline/LegacyAnalysis.tsx` matches the original `frontend/src/app/page.tsx` from that commit. `/baseline` requires both `NEXT_PUBLIC_ENABLE_BASELINE=true` and an explicit separate `NEXT_PUBLIC_API_BASE_URL`. Do not run that baseline backend against saved data for experiments.

The importer refuses the protected original as its source or destination. Prepare a consistent **copy** first (SQLite backup, or a closed database copy including any active WAL). Use a disposable destination for the first rehearsal. From `backend/`:

```sh
python -B -m tracker.legacy_import \
  --source-copy /absolute/path/legacy-copy.sqlite3 \
  --destination /absolute/path/disposable-tracker.sqlite3 \
  --source-namespace my-legacy-copy
```

This is a dry run: rows roll back, although an empty destination schema may be created. Add `--apply` only for the intended destination. The CLI makes a unique consistent destination backup first when it exists. Stop the tracker before import/recovery; do not modify the source during a copy/import.

Every legacy analysis becomes its own application: suspected duplicates are **not merged**. Original text and every original column are retained in the raw record, original numeric IDs are mapped by source namespace, and document versions are marked `legacy_unknown_provenance`. Invalid/oversized display fields may be normalized for current forms, with the raw originals retained. Legacy scores are shown separately as uncalibrated historical output with no verified citations. No model/prompt metadata is invented.

Use the **same source namespace** for repeat imports: identical records skip, changed records abort the entire transaction. An explicit new namespace retains a second independent import. This prevents silent overwrites. To recover, stop the destination service and restore its pre-import backup into a **new** selected file, verify counts, and restart against that file. Never restore over the original saved database.

Rehearsals cover synthetic rollback/recovery, repeat imports, and unchanged source bytes. An additional disposable rehearsal used a copy of the real saved database, checked record mappings/counts and repeat imports, and removed its private temporary copies. No content was printed or imported into the development/original database.

## Fresh checkout and checks

The commands below require Python 3.11, Node 24/npm, and Chrome/Chromium for browser checks. They do **not** require Conda, a private database, `.env`, an API key, or any machine-specific project path. The Windows PowerShell equivalents are above. Source and checks are included in the repository; private local state is deliberately excluded.

```sh
# Repository root: install the existing pinned dependencies into an isolated environment.
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cd frontend
npm ci
npm run lint
npx --no-install next typegen
npm run typecheck
NEXT_PUBLIC_TRACKER_API_URL=http://127.0.0.1:43128 npm run build
cd ..
```

No dependency versions are changed by these setup commands. Route type generation makes the standalone type check work before a first build.


```sh
# Existing backend environment, from backend/
python -B -m unittest discover -s tests -v

# From frontend/ with Node 24
npm run lint
npm run typecheck
NEXT_PUBLIC_TRACKER_API_URL=http://127.0.0.1:43128 npm run build

# Repository root, frontend preview running
TRACKER_TEST_PYTHON="$(command -v python)" node scripts/browser-check.mjs
node --test scripts/export-check.test.mjs
python -B evaluation/validate_cases.py
python -B -m unittest discover -s evaluation -v
python -B evaluation/harness.py score --split development --output /tmp/jobfolio-eval.json
```

API tests use temporary databases and block outbound sockets. Browser tests start their own backend/database and an extension-free Chrome profile, redirect API calls to that test backend, block external requests, and stop only their own processes. They cover the persisted review workflow, duplicate/lost-response recovery, version immutability, invalid citations (API), archive/restore, labels/focus, mobile layout and hydration warnings. No blanket hydration suppression is used. These are smoke checks, not a complete accessibility audit.

The browser driver discovers macOS, Linux and Windows Chrome; `TRACKER_CHROME_PATH`, `TRACKER_TEST_PYTHON`, `TRACKER_PREVIEW_URL`, and `TRACKER_PREVIEW_API` support local overrides. It prints temporary screenshots/results. The installed Starlette test client emits an upstream httpx deprecation warning; no dependencies were changed to suppress it.

See [evaluation/README.md](evaluation/README.md) for the frozen baseline manifest, draft expectations, human rating protocol and offline harness. No model accuracy, latency, cost improvement or user-impact metric is claimed.

### CI and its local equivalent

`.github/workflows/checks.yml` runs on push, pull request and manual dispatch with read-only repository permissions. It uses Python 3.11, Node 24, `pip install -r backend/requirements.txt`, and `npm ci`. It has no API secrets and never needs saved databases. The browser job uses the runner’s Chrome, an extension-free temporary profile, its own synthetic backend/database, and a temporary **production** frontend on a free port. API requests are intercepted into the mock backend. Only synthetic screenshots, results, and a frontend log are uploaded; database files and Chrome profiles are excluded.

After building with the API URL shown above, run the same browser entry point locally from the repository root:

```sh
TRACKER_TEST_PYTHON="$(command -v python)" node scripts/ci-browser.mjs
```

It starts and stops only its own processes; an existing preview is not used or interrupted. Default Chrome discovery supports macOS, Windows installation locations and Linux PATH; `TRACKER_CHROME_PATH` is an explicit override. The Node CSV tests may emit a harmless module-format detection warning without changing the project’s existing package mode.

The workflow YAML and job commands were checked locally, including backend tests from a clean source copy without databases or `.env` files. **GitHub-hosted execution, Linux package installation and artifact upload remain unverified until the workflow runs on GitHub.** See the latest handoff below and the repository’s Actions tab for subsequent hosted results. Current action/runner choices follow [GitHub’s setup-node](https://github.com/actions/setup-node), [setup-python](https://github.com/actions/setup-python), and [Ubuntu runner inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md).

See [the focused implementation review](docs/final-focused-review.md) for confirmed defects, regressions and remaining concerns. Valid schemas, exact quotations and mocks are not model-accuracy measurements.

## Next useful work

1. Human-review the development expectations and inspect real responses in a separately authorized, bounded live smoke test. Check refusal/incomplete cases and record actual usage before comparing models.
2. Refine prompting from observed failure cases, then run held-out evaluation without tuning against it. Grow to 30–50 synthetic or permissioned pairs.
3. Add deletion and retention controls before using sensitive real documents regularly. PDF parsing, a hosted multi-user service, and new providers remain optional future projects.
