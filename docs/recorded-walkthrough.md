# Recorded workflow and clarity pass

November 7, 2026. Uncommitted local work; no paid requests, deployment or dependency changes to the application.

Open [the local comparison player](../artifacts/walkthrough/index.html), [after MP4](../artifacts/walkthrough/after-walkthrough.mp4), or [before MP4](../artifacts/walkthrough/before-walkthrough.mp4). The files are local artifacts excluded from Git. Their absolute directory is `/Users/jayma/Desktop/Stuff/AI Job Tracker/artifacts/walkthrough/`.

Both are actual continuous Chrome sessions at 1440 × 1000, encoded as H.264 MP4 at 15 fps. Normal pauses are retained; there is no narration or speed-up. Capture uses Chrome DevTools screencast frames, not a slideshow assembled from checkpoint screenshots. Checkpoint PNGs and actual downloaded CSV/TXT files are retained alongside each synthetic session database. Both MP4 streams decode without errors; isolated Chrome playback checks verify advancing playback, duration and dimensions. Encoded source-passage frames were visually inspected for legibility. Use fullscreen or original size.

The before video was captured **after the backend mock blocker fix and before the UI clarity changes**. Each recording creates its own Cedar Studio synthetic application in a separate database. Neither operates on the manual walkthrough application. Same steps and pauses, separate persisted records. Chapter times below are approximate (frame timing can differ by a few seconds).

| Step | Before | After |
| --- | --- | --- |
| Dashboard | 00:00 | 00:00 |
| Create an application | 00:06 | 00:06 |
| Saved without AI | 00:12 | 00:12 |
| Edit and set a follow-up | 00:18 | 00:18 |
| Tracking details saved | 00:23 | 00:23 |
| Archive confirmation | 00:28 | 00:29 |
| Archived application | 00:33 | 00:33 |
| Restore and persisted activity | 00:38 | 00:38 |
| Save résumé text | 00:43 | 00:43 |
| Save job description | 00:51 | 00:51 |
| Saved document versions | 00:57 | 00:57 |
| Labeled mock review request | 01:02 | 01:02 |
| Saved mock result | 01:11 | 01:11 |
| Requirement and exact supporting passage | 01:20 | 01:19 |
| Clarification without invented metrics | 01:28 | 01:28 |
| Compare original and suggested wording | 01:34 | 01:34 |
| Saved revision decision | 01:43 | 01:43 |
| Applied as a new version | 01:50 | 01:50 |
| Persisted answer and decision history | 01:56 | 01:56 |
| Application activity after review | 02:02 | 02:02 |
| Reopen saved review with original sources | 02:10 | 02:09 |
| Original résumé remains unchanged | 02:17 | 02:17 |
| Download selected résumé text | 02:24 | 02:24 |
| Export scope follows the filtered list | 02:29 | 02:29 |

## Changes and confirmed defects

- **Mock blocker:** a saved synthetic résumé had a trailing newline and failed the exact byte comparison. The fixture gate now tolerates blank lines, indentation and CRLF, but rejects changed claims. References still quote the untouched original passages. A regression tests both formatting and changed-content rejection. The user's previously failing input was also validated read-only; its failed run was retained.
- **Application form:** company and role plus Save are visible together. Optional tracking fields collapse on creation and open when editing. Instructions and the side card are shorter. Validation reopens a collapsed section and focuses its invalid field without clearing input; a targeted browser regression covers this.
- **Saved review:** completed results lead with evidence; another request is in a disclosure. Three anchors guide evidence → context → wording. Custom wording and technical/version references are optional disclosures. After applying, a direct link leads to saved versions.
- **Navigation:** one document workspace link appears when both inputs exist. The sidebar's **Review demo** clearly labels the separate unsaved example; repeated demo links were removed.
- **Observed regressions fixed:** Coming up explains its four-row limit; singular record/version counts are grammatical; required version-name and text fields are marked; known mock failures explicitly say no AI call or charge and offer one deliberate retry action.
- **History:** a creation marker is saved atomically for new applications, deduplicated on retries. New records do not receive a missing-history warning. Older records retain an optional explanation. No historical transitions, timestamps or existing rows are backfilled.

## Evidence and limits

53 backend tests, 63 browser checks, 5 export tests and 5 evaluation-harness tests pass. Lint, standalone TypeScript, production build and whitespace checks pass. The browser suite also passes against a temporary production frontend using the CI entry point. GitHub itself has not run it. API tests block outbound sockets. Browser checks use a synthetic mock backend, cover mobile overflow/labels/focus, and inject failed writes and lost responses. They also check duplicate requests, original-source references, retained inputs, decisions and retry-safe application of revisions. Backend cases additionally cover concurrent requests, invalid evidence and interruption recovery. The videos show the successful desktop journey, not these injected failures or mobile checks.

The existing local preview remains at `http://127.0.0.1:43127` with mock backend `http://127.0.0.1:43128`. Original database/baseline hashes and all 20 pre-existing development-row fingerprints were preserved. GitHub-hosted CI, a full accessibility audit, public hosting and live model behavior remain unverified. No model-quality improvement is claimed. Mocks still accept only the supplied example content, not arbitrary résumés or personalized clarification-driven output.

## Design decisions to explain

Keep tracking independent of AI. Store document versions and decisions immutably so a review can always show what it actually read. Treat exact quotes as reference integrity, not proof of semantic correctness. Use disclosures to make the next action clear while retaining provenance and recovery controls. Record new activity transactionally rather than fabricating a complete past. Test failure behavior independently from a polished demonstration.

## Re-record locally

Start the documented frontend preview first. With existing Python dependencies, Node 24, Chrome and an FFmpeg executable available, run from the repository root:

```sh
RECORDING_LABEL=my-review \
TRACKER_TEST_PYTHON="$(command -v python)" \
TRACKER_FFMPEG="$(command -v ffmpeg)" \
node scripts/record-walkthrough.mjs
```

Optional `TRACKER_ARTIFACTS_PARENT`, `TRACKER_PREVIEW_URL`, `TRACKER_PREVIEW_API` and `TRACKER_CHROME_PATH` override local defaults. The recorder creates and stops only its own temporary mock backend/browser profile and refuses to overwrite an existing movie. Recording artifacts include synthetic SQLite files and browser downloads, so they stay excluded from Git/CI uploads. For this pass, the encoder was supplied by `imageio-ffmpeg==0.6.0` installed into a temporary directory outside the project; no dependency manifest or lockfile changed. Recording requires local process/socket permission in this sandbox.
