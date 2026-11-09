from contextlib import closing
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from sqlalchemy import text
from tracker.api import create_app
from tracker import provider
from tracker.documents import make_document, validate_output
from tracker.review_models import Document, ReviewRun
from tracker.legacy_import import import_copy, backup_destination
from tracker.database import LEGACY_DATABASE


def uid(): return str(uuid4())


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='jobfolio-review-')
        self.path = Path(self.temp.name) / 'test.sqlite3'
        self.env = patch.dict(os.environ, {'TRACKER_REVIEW_MODE': 'mock'})
        self.env.start()
        self.network = patch('socket.socket.connect', side_effect=AssertionError('No paid/network calls in tests'))
        self.network.start()
        self.context = TestClient(create_app(self.path), raise_server_exceptions=False)
        self.client = self.context.__enter__()
        self.app_id = self.client.post('/applications', json={'company': 'Synthetic', 'role': 'Developer'}).json()['id']
        self.resume = self.document('resume', provider.DEMO_RESUME)
        self.job = self.document('job', provider.DEMO_JOB)

    def tearDown(self):
        self.context.__exit__(None, None, None)
        self.env.stop(); self.network.stop(); self.temp.cleanup()

    def document(self, kind, content, parent=None):
        response = self.client.post(f'/applications/{self.app_id}/documents', json={'id': uid(), 'kind': kind, 'label': 'Synthetic v1', 'text': content, 'parent_id': parent})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def request(self, **changes):
        return self.client.post(f'/applications/{self.app_id}/reviews', json={'id': uid(), 'expected_mode': 'mock', 'expected_model': None, 'resume_id': self.resume['id'], 'job_id': self.job['id'], **changes})

    def review(self):
        response = self.request(); self.assertEqual(response.status_code, 202, response.text)
        return self.client.get('/reviews/' + response.json()['id']).json()

    def event(self, run, **values):
        return self.client.post(f'/reviews/{run["id"]}/events', json={'id': uid(), **values})

    def test_immutable_versions_and_exact_unicode_passage_offsets(self):
        original = self.document('resume', 'Résumé\r\n  • Built a café app.\n\nProject')
        revised = self.document('resume', 'Changed text', original['id'])
        for passage in original['passages']:
            self.assertEqual(original['text'][passage['start']:passage['end']], passage['text'])
        self.assertEqual(revised['parent_id'], original['id'])
        with self.client.app.state.sessions() as db:
            for action in ['UPDATE document_versions SET text=\'bad\'', 'DELETE FROM document_versions']:
                with self.assertRaises(Exception): db.execute(text(action)); db.commit()
                db.rollback()
        docs = self.client.get(f'/applications/{self.app_id}/workspace').json()['documents']
        self.assertEqual(next(d['text'] for d in docs if d['id'] == original['id']), original['text'])

    def test_document_retry_and_conflict(self):
        fields = {'id': uid(), 'kind': 'resume', 'label': 'Retry', 'text': 'Exact saved text'}
        url = f'/applications/{self.app_id}/documents'
        a = self.client.post(url, json=fields); b = self.client.post(url, json=fields)
        self.assertEqual(a.json(), b.json())
        self.assertEqual(self.client.post(url, json={**fields, 'text': 'Changed'}).status_code, 409)

    def test_mock_history_has_honest_provenance_and_no_score(self):
        run = self.review()
        self.assertEqual(run['status'], 'succeeded')
        self.assertIsNone(run['model_returned']); self.assertIsNone(run['usage'])
        self.assertEqual(run['mode'], 'mock'); self.assertNotIn('match_score', run['result'])
        self.assertTrue(run['prompt_hash']); self.assertEqual(run['resume_id'], self.resume['id'])
        self.document('resume', 'An unrelated later revision', self.resume['id'])
        self.assertEqual(self.client.get('/reviews/' + run['id']).json()['result'], run['result'])

    def test_mock_accepts_paste_whitespace_without_rewriting_sources(self):
        content = '\r\n  ' + provider.DEMO_RESUME.replace('\n', '  \r\n\r\n  ') + '  \r\n'
        self.resume = self.document('resume', content)
        self.job = self.document('job', provider.DEMO_JOB + '\n')
        run = self.review()
        self.assertEqual(run['status'], 'succeeded')
        quote = run['result']['requirements'][0]['evidence'][0]
        self.assertEqual(quote['quote'], self.resume['passages'][1]['text'])
        self.assertEqual(quote['document_id'], self.resume['id'])
        self.assertEqual(self.client.get(f'/applications/{self.app_id}/workspace').json()['documents'][1]['text'], content)
        changed = self.document('resume', provider.DEMO_RESUME.replace('University project', 'Professional employment'))
        failed = self.client.get('/reviews/' + self.request(resume_id=changed['id']).json()['id']).json()
        self.assertEqual(failed['status'], 'failed')
        self.assertIn('no AI call or charge', failed['error'])

    def test_double_submit_and_lost_response_generate_once(self):
        with patch('tracker.provider.generate', wraps=provider.generate) as generate:
            request_id = uid()
            a = self.request(id=request_id).json()
            b = self.request(id=request_id).json()
            c = self.request().json()
            self.assertEqual(a['id'], b['id']); self.assertEqual(a['id'], c['id'])
            self.assertEqual(generate.call_count, 1)

    def test_concurrent_different_keys_same_inputs_generate_once(self):
        with patch('tracker.provider.generate', wraps=provider.generate) as generate:
            with ThreadPoolExecutor(max_workers=2) as pool:
                replies = list(pool.map(lambda _: self.request(), range(2)))
            self.assertEqual([r.status_code for r in replies], [202, 202])
            self.assertEqual(replies[0].json()['id'], replies[1].json()['id'])
            self.assertEqual(generate.call_count, 1)

    def test_invalid_quote_is_quarantined(self):
        def bad(mode, model, resume, job, answers):
            output = provider.mock_output(resume, job)
            output['requirements'][0]['evidence'][0]['quote'] = 'Invented résumé quote'
            return provider.ProviderResult(output)
        with patch('tracker.provider.generate', side_effect=bad): run = self.review()
        self.assertEqual(run['status'], 'invalid_output'); self.assertIsNone(run['result'])
        self.assertTrue(run['validation_issues'])
        self.assertEqual(self.event(run, kind='decision', target_id='v1', decision='accept', confirmed_facts=True).status_code, 409)

    def test_validation_catches_wrong_document_missing_evidence_metrics_and_overlap(self):
        resume = make_document(self.resume['id'], self.app_id, 'resume', 'v1', provider.DEMO_RESUME)
        job = make_document(self.job['id'], self.app_id, 'job', 'v1', provider.DEMO_JOB)
        result = provider.mock_output(resume, job)
        result['requirements'][0]['job_evidence']['document_id'] = resume.id
        result['requirements'][0]['evidence'] = []
        result['revisions'][0]['proposed'] += ' Increased engagement 45%.'
        result['revisions'].append(result['revisions'][0].copy())
        issues = validate_output(result, resume, job, {})
        self.assertGreaterEqual(len(issues), 4)

    def test_timeout_is_durable_and_retry_requires_explicit_acknowledgment(self):
        with patch('tracker.provider.generate', side_effect=provider.ProviderFailure('Unknown provider outcome', uncertain=True)) as generate:
            run = self.review(); same = self.request().json()
            self.assertEqual(same['id'], run['id']); self.assertEqual(generate.call_count, 1)
            self.assertEqual(run['status'], 'uncertain')
            self.assertEqual(self.request(retry_of=run['id']).status_code, 409)
            retry = self.request(retry_of=run['id'], acknowledge_new_request=True)
            self.assertEqual(retry.status_code, 202); self.assertEqual(generate.call_count, 2)

    def test_server_restart_marks_unfinished_run_uncertain_without_replay(self):
        with patch('tracker.review_api.execute_review'):
            run = self.request().json()
        with patch('tracker.provider.generate') as generate, TestClient(create_app(self.path)) as other:
            self.assertEqual(other.get('/reviews/' + run['id']).json()['status'], 'uncertain')
            generate.assert_not_called()

    def test_configuration_failure_does_not_create_run(self):
        with patch.dict(os.environ, {'TRACKER_REVIEW_MODE': 'openai', 'OPENAI_API_KEY': ''}):
            self.assertEqual(self.request().status_code, 409)
        self.assertEqual(self.client.get(f'/applications/{self.app_id}/workspace').json()['reviews'], [])

    def test_unrecognized_mock_text_is_a_failure_not_fabricated_success(self):
        self.resume = self.document('resume', 'Different synthetic document')
        self.assertEqual(self.review()['status'], 'failed')

    def test_cross_application_sources_and_answers_are_rejected(self):
        other = self.client.post('/applications', json={'company': 'Other', 'role': 'Role'}).json()['id']
        response = self.client.post(f'/applications/{other}/reviews', json={'id': uid(), 'resume_id': self.resume['id'], 'job_id': self.job['id']})
        self.assertEqual(response.status_code, 422)

    def test_answers_decisions_apply_and_reopen(self):
        run = self.review()
        answer = self.event(run, kind='clarification', target_id='q1', answer='I did not measure outcomes.').json()
        decision = self.event(run, kind='decision', target_id='v1', decision='edit', text='Built a React and TypeScript course planner with labeled forms and keyboard navigation.', confirmed_facts=True).json()
        payload = {'id': uid(), 'event_ids': [decision['id']]}
        url = f'/reviews/{run["id"]}/apply'
        applied = self.client.post(url, json=payload)
        self.assertEqual(applied.status_code, 201, applied.text)
        self.assertEqual(applied.json()['parent_id'], self.resume['id'])
        self.assertEqual(self.client.post(url, json=payload).json()['id'], applied.json()['id'])
        repeated = self.client.post(url, json={**payload, 'id': uid()})
        self.assertEqual(repeated.json()['id'], applied.json()['id'])
        reopened = self.client.get('/reviews/' + run['id']).json()
        self.assertEqual(len(reopened['events']), 2)
        self.assertEqual(len(reopened['applied_versions']), 1)
        self.assertEqual(reopened['result'], run['result'])
        with patch('tracker.provider.generate', wraps=provider.generate) as generate:
            newer = self.request(clarification_event_ids=[answer['id']]).json()
            self.assertNotEqual(newer['id'], run['id'])
            self.assertEqual(generate.call_args.args[4][0]['answer'], 'I did not measure outcomes.')

    def test_reject_supersedes_accept_and_no_mutation_of_history(self):
        run = self.review()
        self.assertEqual(self.event(run, kind='decision', target_id='v1', decision='accept').status_code, 422)
        accept = self.event(run, kind='decision', target_id='v1', decision='accept', confirmed_facts=True).json()
        reject = self.event(run, kind='decision', target_id='v1', decision='reject').json()
        url = f'/reviews/{run["id"]}/apply'
        self.assertEqual(self.client.post(url, json={'id': uid(), 'event_ids': [accept['id']]}).status_code, 409)
        self.assertEqual(self.client.post(url, json={'id': uid(), 'event_ids': [reject['id']]}).status_code, 422)
        with self.client.app.state.sessions() as db:
            with self.assertRaises(Exception): db.execute(text('DELETE FROM review_events')); db.commit()

    def test_provider_sdk_contract_without_network(self):
        resume = make_document(self.resume['id'], self.app_id, 'resume', 'v1', provider.DEMO_RESUME)
        job = make_document(self.job['id'], self.app_id, 'job', 'v1', provider.DEMO_JOB)
        from tracker.review_schema import ReviewOutput
        response = Mock(status='completed', output_parsed=ReviewOutput.model_validate(provider.mock_output(resume, job)), model='mock-returned-model', usage=None, id='mock-response')
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fake-test-only'}), patch('openai.OpenAI') as sdk:
            sdk.return_value.__enter__.return_value.responses.parse.return_value = response
            reply = provider.generate('openai', 'configured-model', resume, job, [])
            self.assertEqual(reply.model, 'mock-returned-model')
            self.assertEqual(sdk.call_args.kwargs['max_retries'], 0)
            kwargs = sdk.return_value.__enter__.return_value.responses.parse.call_args.kwargs
            self.assertFalse(kwargs['store']); self.assertEqual(kwargs['model'], 'configured-model')
            self.assertNotIn('tools', kwargs)


    def test_provider_refusal_keeps_available_provenance(self):
        with patch('tracker.provider.generate', side_effect=provider.ProviderFailure(
            'Refused', metadata={'model_returned': 'mock-model', 'usage': {'input_tokens': 10}, 'provider_response_id': 'mock-refusal'})):
            run = self.review()
        self.assertEqual(run['status'], 'failed')
        self.assertIsNone(run['result'])
        self.assertEqual(run['usage'], {'input_tokens': 10})
        self.assertEqual(run['provider_response_id'], 'mock-refusal')

    def test_invalid_structure_is_not_returned_as_success(self):
        with patch('tracker.provider.generate', return_value=provider.ProviderResult({'summary': 'Incomplete mock output'}, usage={'input_tokens': 3})):
            run = self.review()
        self.assertEqual(run['status'], 'invalid_output')
        self.assertIsNone(run['result'])
        self.assertEqual(run['usage'], {'input_tokens': 3})

    def test_live_adapter_timeout_and_authentication_errors_are_sanitized(self):
        import httpx
        from openai import APITimeoutError, AuthenticationError
        resume = make_document(self.resume['id'], self.app_id, 'resume', 'v1', provider.DEMO_RESUME)
        job = make_document(self.job['id'], self.app_id, 'job', 'v1', provider.DEMO_JOB)
        request = httpx.Request('POST', 'https://api.openai.com/v1/responses')
        failures = [APITimeoutError(request=request), AuthenticationError('private-provider-error', response=httpx.Response(401, request=request), body=None)]
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fake-test-only'}), patch('openai.OpenAI') as sdk:
            for failure in failures:
                sdk.return_value.__enter__.return_value.responses.parse.side_effect = failure
                with self.assertRaises(provider.ProviderFailure) as caught:
                    provider.generate('openai', 'configured-model', resume, job, [])
                self.assertNotIn('private-provider-error', str(caught.exception))
                self.assertEqual(caught.exception.uncertain, isinstance(failure, APITimeoutError))


class LegacyImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='legacy-rehearsal-')
        self.source = Path(self.temp.name) / 'legacy-copy.sqlite3'
        self.dest = Path(self.temp.name) / 'destination.sqlite3'
        with closing(sqlite3.connect(self.source)) as db, db:
            db.execute('CREATE TABLE analyses (id INTEGER PRIMARY KEY, resume_text TEXT, job_description TEXT, company_name TEXT, job_title TEXT, match_score INTEGER, summary TEXT)')
            for id in [7, 9]: db.execute('INSERT INTO analyses VALUES (?,?,?,?,?,?,?)', (id, 'Synthetic project\nUsed Python.', 'Requires Python', 'Same company', 'Same role', 77, 'Unverified legacy output'))
        self.before = self.source.read_bytes()

    def tearDown(self): self.temp.cleanup()

    def test_import_dry_run_repeat_counts_and_preserved_content(self):
        self.assertEqual(import_copy(self.source, self.dest, 'fixture')['would_import'], 2)
        with closing(sqlite3.connect(self.dest)) as db, db: self.assertEqual(db.execute('SELECT count(*) FROM applications').fetchone()[0], 0)
        result = import_copy(self.source, self.dest, 'fixture', apply=True)
        self.assertEqual(result['imported'], 2)
        again = import_copy(self.source, self.dest, 'fixture', apply=True)
        self.assertEqual(again['skipped_unchanged'], 2)
        with closing(sqlite3.connect(self.dest)) as db, db:
            self.assertEqual(db.execute('SELECT count(*) FROM applications').fetchone()[0], 2)
            self.assertEqual(db.execute('SELECT count(*) FROM document_versions').fetchone()[0], 4)
            self.assertEqual(db.execute('SELECT count(*) FROM review_runs').fetchone()[0], 0)
            payload = json.loads(db.execute('SELECT raw_record FROM legacy_imports WHERE legacy_id="7"').fetchone()[0])
            self.assertEqual(payload['resume_text'], 'Synthetic project\nUsed Python.')
            self.assertNotIn('model', payload)
        self.assertEqual(self.before, self.source.read_bytes())

    def test_transaction_failure_rolls_back_and_backup_can_be_restored(self):
        import_copy(self.source, self.dest, 'fixture')
        backup = backup_destination(self.dest)
        with self.assertRaises(RuntimeError): import_copy(self.source, self.dest, 'fixture', apply=True, fail_after=1)
        with closing(sqlite3.connect(self.dest)) as db, db: self.assertEqual(db.execute('SELECT count(*) FROM applications').fetchone()[0], 0)
        import_copy(self.source, self.dest, 'fixture', apply=True)
        restored = Path(self.temp.name) / 'restored.sqlite3'
        with closing(sqlite3.connect(backup)) as source, source, closing(sqlite3.connect(restored)) as target, target: source.backup(target)
        with closing(sqlite3.connect(restored)) as db, db: self.assertEqual(db.execute('SELECT count(*) FROM applications').fetchone()[0], 0)
        self.assertEqual(import_copy(self.source, restored, 'fixture', apply=True)['imported'], 2)

    def test_changed_source_aborts_and_original_is_refused(self):
        import_copy(self.source, self.dest, 'fixture', apply=True)
        with closing(sqlite3.connect(self.source)) as db, db: db.execute('UPDATE analyses SET resume_text="Different" WHERE id=7')
        with self.assertRaises(ValueError): import_copy(self.source, self.dest, 'fixture', apply=True)
        with self.assertRaises(ValueError): import_copy(LEGACY_DATABASE, self.dest, 'protected', apply=True)
