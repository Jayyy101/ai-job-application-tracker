"""Offline evaluation packets and reports. This module never calls a provider."""
import argparse
import json
import sys
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from tracker.documents import make_document, serialize, validate_output
from tracker.review_schema import ReviewOutput
from tracker.provider import PROMPT_VERSION, PROMPT_HASH, SCHEMA_VERSION


def packet(case):
    docs = {}
    for kind, field in [('resume', 'resume_text'), ('job', 'job_description')]:
        id = str(uuid5(NAMESPACE_URL, f'jobfolio-eval:{case["id"]}:{kind}:v1'))
        docs[kind] = make_document(id, 'evaluation-only', kind, case['id'], case[field])
    return docs


def evaluate(cases, predictions, human_labels):
    """Interpretation is human scored; only schema/reference checks are automatic."""
    by_id = {p['case_id']: p for p in predictions}
    if len(by_id) != len(predictions): raise ValueError('Duplicate prediction case IDs.')
    allowed = {c['id'] for c in cases}
    if not set(by_id).issubset(allowed): raise ValueError('Predictions include cases outside the selected split.')
    if not set(human_labels).issubset(set(by_id)): raise ValueError('Human labels must refer to supplied predictions.')
    report = []
    for case in cases:
        prediction = by_id.get(case['id'])
        if prediction is None:
            report.append({'case_id': case['id'], 'state': 'unmeasured'}); continue
        if prediction.get('origin') not in ('mock', 'model'):
            raise ValueError('Each prediction must label origin as mock or model.')
        provenance = prediction.get('provenance', {})
        if prediction['origin'] == 'model' and not all(provenance.get(k) for k in ('model_requested', 'prompt_version', 'schema_version', 'timestamp')):
            raise ValueError('Model measurements require model/prompt/schema/timestamp provenance; returned model may remain unknown.')
        docs = packet(case)
        try:
            output = ReviewOutput.model_validate(prediction['output']).model_dump()
            issues = validate_output(output, docs['resume'], docs['job'], {})
            valid_schema = True
        except Exception:
            valid_schema, issues, output = False, ['Schema validation failed.'], None
        labels = human_labels.get(case['id'])
        metrics = None
        if labels:
            if labels.get('expectation_status') != 'human_reviewed' or not labels.get('reviewer'):
                raise ValueError('Human measurements need a reviewer and reviewed expectations; draft criteria are not gold labels.')
            expected = case['expected_requirements']
            alignments = labels.get('requirement_alignment', [])
            matches, priorities, total = 0, 0, len(expected)
            used = set()
            for a in alignments:
                i = a['expected_index']
                if i in used or not 0 <= i < total: raise ValueError('Invalid or duplicate human requirement alignment.')
                used.add(i)
                found = next((r for r in output['requirements'] if r['id'] == a['output_id']), None) if output else None
                if found:
                    matches += found['assessment'] == expected[i]['status']
                    priorities += found['importance'] == expected[i]['importance']
            # Nulls remain unmeasured. Do not infer faithfulness from matching substrings.
            metrics = {'requirement_assessment_agreement': matches / total if total else None,
                       'importance_agreement': priorities / total if total else None,
                       'human_evidence_correct': labels.get('evidence_correct'),
                       'human_evidence_total': labels.get('evidence_total'),
                       'unsupported_claim_count': labels.get('unsupported_claim_count'),
                       'missing_information_handled': labels.get('missing_information_handled'),
                       'revision_faithful': labels.get('revision_faithful'),
                       'revision_usefulness_1_to_5': labels.get('revision_usefulness_1_to_5'),
                       'reviewer': labels['reviewer']}
        report.append({'case_id': case['id'], 'state': prediction['origin'], 'schema_valid': valid_schema,
            'source_validation_issues': issues, 'human_measurements': metrics,
            'latency_ms': prediction.get('latency_ms'), 'usage': prediction.get('usage'),
            'cost_usd': prediction.get('cost_usd'), 'provenance': provenance})
    return {'expectations': 'Draft until explicitly human-reviewed. No model quality inferred from mocks or quote checks.',
            'model_runs': sum(r['state'] == 'model' for r in report),
            'mock_runs': sum(r['state'] == 'mock' for r in report), 'cases': report}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'score'])
    parser.add_argument('--split', required=True, choices=['development', 'held_out'])
    parser.add_argument('--predictions', type=Path)
    parser.add_argument('--human-labels', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    dataset = json.loads((Path(__file__).parent / 'starter_cases.json').read_text())
    cases = [c for c in dataset['cases'] if c['split'] == args.split]
    if args.command == 'prepare':
        result = {'split': args.split, 'prompt_version': PROMPT_VERSION, 'prompt_hash': PROMPT_HASH, 'schema_version': SCHEMA_VERSION,
                  'cases': [{'case_id': c['id'], **{kind: {'document_id': doc.id, 'passages': doc.passages} for kind, doc in packet(c).items()}} for c in cases]}
    else:
        predictions = json.loads(args.predictions.read_text()) if args.predictions else []
        labels = json.loads(args.human_labels.read_text()) if args.human_labels else {}
        result = {'split': args.split, **evaluate(cases, predictions, labels)}
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(f'{args.command}: {len(cases)} {args.split} cases; output {args.output}. No provider calls.')


if __name__ == '__main__': main()
