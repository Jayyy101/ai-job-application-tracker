import unittest
from harness import evaluate, packet

CASE = {'id': 'contract-only', 'resume_text': 'Used Python for a class project.', 'job_description': 'Required: Python.', 'expected_requirements': [{'status': 'supported', 'importance': 'required'}]}


def mock_prediction():
    docs = packet(CASE)
    def cite(kind):
        d = docs[kind]
        return {'document_id': d.id, 'passage_id': d.passages[0]['id'], 'quote': d.text}
    return {'case_id': CASE['id'], 'origin': 'mock', 'output': {'summary': 'Mock contract fixture', 'requirements': [{'id': 'r1', 'text': 'Python', 'importance': 'required', 'assessment': 'supported', 'explanation': 'Class project, not employment.', 'experience_context': 'coursework', 'job_evidence': cite('job'), 'evidence': [cite('resume')]}], 'clarifications': [], 'revisions': []}}


class HarnessTests(unittest.TestCase):
    def test_unmeasured_stays_unmeasured(self):
        r = evaluate([CASE], [], {})
        self.assertEqual(r['model_runs'], 0); self.assertEqual(r['cases'][0]['state'], 'unmeasured')

    def test_mock_quote_checks_do_not_claim_semantic_accuracy(self):
        r = evaluate([CASE], [mock_prediction()], {})
        self.assertEqual(r['model_runs'], 0); self.assertEqual(r['mock_runs'], 1)
        self.assertIsNone(r['cases'][0]['human_measurements'])
        self.assertEqual(r['cases'][0]['source_validation_issues'], [])

    def test_fabricated_evidence_and_metrics_fail(self):
        p = mock_prediction(); r = p['output']['requirements'][0]
        r['evidence'][0]['quote'] = 'Invented evidence'
        p['output']['revisions'] = [{'id': 'v1', 'source': {**r['evidence'][0], 'quote': CASE['resume_text']}, 'proposed': 'Improved speed by 90%.', 'rationale': 'Fabricated test', 'clarification_ids': []}]
        result = evaluate([CASE], [p], {})['cases'][0]
        self.assertEqual(len(result['source_validation_issues']), 2)

    def test_classification_and_faithfulness_need_human_labels(self):
        p = mock_prediction()
        labels = {CASE['id']: {'reviewer': 'Synthetic harness test', 'expectation_status': 'human_reviewed', 'requirement_alignment': [{'expected_index': 0, 'output_id': 'r1'}], 'unsupported_claim_count': 0, 'missing_information_handled': True, 'revision_faithful': None}}
        result = evaluate([CASE], [p], labels)['cases'][0]['human_measurements']
        self.assertEqual(result['importance_agreement'], 1)
        self.assertEqual(result['requirement_assessment_agreement'], 1)
        self.assertIsNone(result['revision_faithful'])

    def test_split_leakage_and_invented_provenance_rejected(self):
        p = mock_prediction(); p['case_id'] = 'held-out-in-wrong-split'
        with self.assertRaises(ValueError): evaluate([CASE], [p], {})
        p = mock_prediction(); p['origin'] = 'model'
        with self.assertRaises(ValueError): evaluate([CASE], [p], {})


if __name__ == '__main__': unittest.main()
