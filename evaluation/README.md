# Starter evaluation set

`starter_cases.json` contains 12 entirely synthetic résumé/job pairs: eight development cases and four held-out cases. Expected labels are **draft criteria for human review**, not completed human ratings or measured model results. No API calls have been made for this set.

The set covers positive evidence, negation, implied skills, project versus professional experience, required/preferred distinctions, missing evidence, invented metrics, document instructions, duration, and nontechnical experience. It is intentionally too small for broad performance claims.

## Baseline and comparison protocol

`baseline_manifest.json` identifies the unchanged original service at commit `7219205`, its source/prompt hashes, and the configured `gpt-5.4-mini` alias. The alias is not a proven historical model snapshot. Keep keyword fallback results separate from live AI results. The original output has no verified reference structure; record unavailable capabilities rather than inventing baseline citation scores.

1. Have a person review the expected requirements, source passages, acceptable alternatives, and forbidden claims. Record disagreements.
2. Freeze the held-out examples before prompt tuning. Split future examples by résumé/job family, not random near-duplicates.
3. Once paid calls are separately authorized, run the unchanged model/prompt baseline in a sanitized temporary backend copy. Never use the saved legacy database.
4. Compare the revised workflow on the same model before attributing improvement to a replacement model.
5. Capture requested/returned model IDs, prompt/schema versions, input hashes, output, validation findings, latency, usage, retries, and pricing date. Store only synthetic or explicitly permissioned content.

Measure requirement precision/recall, importance and support-label agreement, exact-reference integrity, semantic evidence relevance, unsupported factual claims (with severe inventions counted individually), and blinded revision usefulness. Measure full-pipeline cost and latency, including failed attempts. Valid JSON and a second model opinion are not proof of accuracy.

For later release review, propose valid references for every displayed citation and no invented employers, experience, or metrics in the release set. Passing this small sample does not establish general factual accuracy. Grow toward 30–50 pairs with a separate validation split and more held-out families.

The fixture in `frontend/src/lib/review-example.ts` is a UX illustration, not an evaluation result. Its source IDs demonstrate the intended interaction; durable résumé-version references are implemented separately in saved review workspaces.

## Reproducible offline harness

`harness.py` never imports an API client or sends model requests. It produces stable document/passage IDs for each case and scores saved outputs. Choose **one split explicitly**; outputs containing IDs outside it are rejected.

```sh
python -B evaluation/harness.py prepare --split development --output /tmp/jobfolio-packets.json
python -B evaluation/harness.py score --split development --output /tmp/jobfolio-unmeasured.json
python -B -m unittest discover -s evaluation -v
```

Without predictions every case remains `unmeasured`, with zero model runs. `--predictions predictions.json` accepts a JSON array:

```json
[{
  "case_id": "explicit-project",
  "origin": "model",
  "output": {},
  "provenance": {
    "model_requested": "the configured model",
    "model_returned": null,
    "prompt_version": "evidence-review-v1",
    "schema_version": "review-v1",
    "timestamp": "actual run timestamp"
  },
  "latency_ms": null,
  "usage": null,
  "cost_usd": null
}]
```

Replace `output` with the saved `ReviewOutput` payload using the prepared document IDs. The real schema is `backend/tracker/review_schema.py`; this skeleton is not a valid prediction. Origins must be `mock` or `model`. Do not relabel mocks as model measurements. Cost remains null unless calculated from recorded usage and a documented price snapshot; failed requests belong in latency/cost accounting too.

Mechanical checks report schema validity and invalid references/quotes, missing evidence, overlap, and unsupported numeric tokens. They do not infer semantic evidence accuracy or revision faithfulness. `--human-labels ratings.json` adds human measurements keyed by case ID. Each rating needs `reviewer`, `expectation_status: "human_reviewed"`, and `requirement_alignment` entries `{ "expected_index": 0, "output_id": "r1" }`. Optional ratings are `evidence_correct`, `evidence_total`, `unsupported_claim_count`, `missing_information_handled`, `revision_faithful`, and `revision_usefulness_1_to_5`. Unrated values remain null. Record reasoning/disagreements alongside the ratings; align requirements manually so string similarity cannot masquerade as correctness.

The harness computes support/importance agreement from those human alignments. Semantic relevance, missed/extra requirements, instructions embedded in documents, negation, missing qualifications, and invented nonnumeric claims must still be reviewed against the case’s draft expectations. The five harness tests use small **mock contract fixtures**, not benchmark results. The API/browser mock uses another fixed synthetic example and is not trained or selected against the held-out set.

The application now implements durable version references. The separate `frontend/src/lib/review-example.ts` illustration remains hand-authored and unsaved.
