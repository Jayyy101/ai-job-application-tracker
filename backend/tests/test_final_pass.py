"""Focused regressions for activity, concurrent retries and review failure boundaries."""
from contextlib import closing
import json
import os
import sqlite3
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.exc import OperationalError
from tracker.api import create_app
from tracker.models import Application, utc_now
from tracker.activity import ActivityEvent
from tracker.review_models import ReviewRun, ReviewEvent, Document
from tracker.review_schema import ReviewOutput
from tracker import provider
from tracker.review_api import save_outcome
from tracker.legacy_import import import_copy


def uid(): return str(uuid4())


class FinalPassTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='jobfolio-final-pass-')
        self.path = Path(self.temp.name) / 'isolated.sqlite3'
        self.mode = patch.dict(os.environ, {'TRACKER_REVIEW_MODE': 'mock'})
        self.network = patch('socket.socket.connect', side_effect=AssertionError('No external calls allowed'))
        self.mode.start(); self.network.start()
        self.context = TestClient(create_app(self.path), raise_server_exceptions=False)
        self.client = self.context.__enter__()
        self.id = self.client.post('/applications', json={'id': uid(), 'company': 'Synthetic résumé café', 'role': 'Developer'}).json()['id']

    def tearDown(self):
        self.context.__exit__(None, None, None)
        self.mode.stop(); self.network.stop(); self.temp.cleanup()

    def events(self): return self.client.get(f'/applications/{self.id}/activity').json()['events']

    def prepare(self):
        docs = []
        for kind, text in [('resume', provider.DEMO_RESUME), ('job', provider.DEMO_JOB)]:
            docs.append(self.client.post(f'/applications/{self.id}/documents', json={'id': uid(), 'kind': kind, 'label': 'Synthetic', 'text': text}).json())
        return {'id': uid(), 'resume_id': docs[0]['id'], 'job_id': docs[1]['id'], 'expected_mode': 'mock', 'expected_model': None}

    def run_review(self, payload):
        response = self.client.post(f'/applications/{self.id}/reviews', json=payload)
        self.assertEqual(response.status_code, 202, response.text)
        return self.client.get('/reviews/' + response.json()['id']).json()

    def test_new_activity_has_no_legacy_warning_and_creation_retries_do_not_duplicate(self):
        payload = {'id': uid(), 'company': 'Fresh synthetic', 'role': 'Developer'}
        for _ in range(2): self.assertEqual(self.client.post('/applications', json=payload).status_code, 201)
        activity = self.client.get(f'/applications/{payload["id"]}/activity').json()
        self.assertEqual(activity['history_note'], '')
        self.assertEqual(len(activity['events']), 1)
        with self.client.app.state.sessions() as db:
            self.assertEqual(len(db.scalars(select(ActivityEvent).where(ActivityEvent.application_id == payload['id'])).all()), 1)
            old = Application(id=uid(), company='Older synthetic', role='Developer')
            db.add(old); db.commit(); old_id = old.id
        older = self.client.get(f'/applications/{old_id}/activity').json()
        self.assertIn('may be missing', older['history_note'])
        self.assertEqual(len(older['events']), 1)

    def test_activity_status_archive_and_receipt_retries_preserve_timestamps(self):
        fields = {'company': 'Synthetic résumé café', 'role': 'Developer', 'status': 'Applied'}
        header = {'X-Request-ID': uid()}
        first = self.client.put(f'/applications/{self.id}', json=fields, headers=header).json()
        self.assertEqual(self.client.put(f'/applications/{self.id}', json=fields, headers=header).json()['updated_at'], first['updated_at'])
        archived = self.client.post(f'/applications/{self.id}/archive', headers={'X-Request-ID': uid()}).json()
        again = self.client.post(f'/applications/{self.id}/archive').json()
        self.assertEqual(archived['archived_at'], again['archived_at'])
        self.assertEqual(archived['updated_at'], again['updated_at'])
        self.client.post(f'/applications/{self.id}/restore')
        self.client.put(f'/applications/{self.id}', json={**fields, 'status': 'Interviewing'}, headers={'X-Request-ID': uid()})
        # Late retry must not revert the newer status.
        late = self.client.put(f'/applications/{self.id}', json=fields, headers=header)
        self.assertEqual(late.json()['status'], 'Interviewing')
        titles = [e['title'] for e in self.events()]
        self.assertEqual(titles.count('Status: Interested → Applied'), 1)
        self.assertEqual(titles.count('Status: Applied → Interviewing'), 1)
        self.assertEqual(titles.count('Application archived'), 1)
        self.assertEqual(titles.count('Application restored'), 1)
        self.assertEqual(len(titles), 5)
        self.assertEqual(self.client.put(f'/applications/{self.id}', json={**fields, 'role': 'Different'}, headers=header).status_code, 409)

    def test_late_archive_retry_does_not_undo_restore(self):
        header = {'X-Request-ID': uid()}
        self.client.post(f'/applications/{self.id}/archive', headers=header)
        self.client.post(f'/applications/{self.id}/restore', headers={'X-Request-ID': uid()})
        replay = self.client.post(f'/applications/{self.id}/archive', headers=header)
        self.assertIsNone(replay.json()['archived_at'])
        self.assertEqual(len(self.events()), 3)

    def test_no_invented_old_status_history_and_only_known_archive_time(self):
        with self.client.app.state.sessions() as db:
            old = db.get(Application, self.id)
            old.status = 'Offer'; old.updated_at = utc_now() - timedelta(days=2)
            old.archived_at = utc_now() - timedelta(days=1)
            db.commit()
        events = self.events()
        self.assertEqual(len(events), 2)
        self.assertFalse(any('Status:' in e['title'] for e in events))
        self.assertIn('saved archive timestamp', events[0]['detail']) if 'archive' in events[0]['id'] else self.assertIn('saved archive timestamp', events[1]['detail'])

    def test_activity_rollback_is_atomic(self):
        with patch('sqlalchemy.orm.Session.commit', side_effect=OperationalError('synthetic', {}, Exception('unavailable'))):
            response = self.client.put(f'/applications/{self.id}', json={'company': 'Synthetic', 'role': 'Developer', 'status': 'Offer'}, headers={'X-Request-ID': uid()})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.client.get(f'/applications/{self.id}').json()['status'], 'Interested')
        self.assertEqual(len(self.events()), 1)

    def test_concurrent_tracking_and_document_replays_are_idempotent(self):
        header = {'X-Request-ID': uid()}
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post(f'/applications/{self.id}/archive', headers=header), range(2)))
        self.assertEqual([r.status_code for r in responses], [200, 200])
        self.assertEqual(len(self.events()), 2)
        doc = {'id': uid(), 'kind': 'resume', 'label': 'Concurrent', 'text': 'Exact text'}
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post(f'/applications/{self.id}/documents', json=doc), range(2)))
        self.assertEqual([r.status_code for r in responses], [201, 201])
        self.assertEqual(len(self.events()), 3)

    def test_timeline_reuses_version_review_and_apply_history_without_duplicates(self):
        run = self.run_review(self.prepare())
        event = self.client.post(f'/reviews/{run["id"]}/events', json={'id': uid(), 'kind': 'decision', 'target_id': 'v1', 'decision': 'accept', 'confirmed_facts': True}).json()
        payload = {'id': uid(), 'event_ids': [event['id']]}
        first = self.client.post(f'/reviews/{run["id"]}/apply', json=payload).json()
        self.client.post(f'/reviews/{run["id"]}/apply', json=payload)
        events = self.events()
        self.assertEqual(len(events), 6)  # creation, two inputs, request, outcome, apply
        self.assertEqual(len({e['id'] for e in events}), 6)
        self.assertEqual(sum(e['href'] == '#version-' + first['id'] for e in events), 1)
        self.assertTrue(any(e['title'] == 'Mock review completed' for e in events))

    def test_changed_provider_config_rejects_stale_mock_consent_without_call(self):
        payload = self.prepare()
        with patch.dict(os.environ, {'TRACKER_REVIEW_MODE': 'openai', 'OPENAI_API_KEY': 'fake-not-used'}), patch('tracker.provider.generate') as generate:
            response = self.client.post(f'/applications/{self.id}/reviews', json=payload)
            self.assertEqual(response.status_code, 409)
            self.assertIn('configuration changed', response.json()['error']['message'])
            generate.assert_not_called()
        self.assertEqual(self.client.get(f'/applications/{self.id}/workspace').json()['reviews'], [])

    def test_post_provider_commit_failure_is_uncertain_and_never_replayed(self):
        payload = self.prepare()
        def fail_once(sessions, id, values):
            if values.get('status') == 'succeeded': raise OperationalError('synthetic', {}, Exception('db outage'))
            return save_outcome(sessions, id, values)
        with patch('tracker.review_api.save_outcome', side_effect=fail_once), patch('tracker.provider.generate', wraps=provider.generate) as generate:
            run = self.run_review(payload)
            self.assertEqual(run['status'], 'uncertain')
            self.assertIsNone(run['result'])
            self.run_review(payload)
            self.assertEqual(generate.call_count, 1)

    def test_orphaned_running_request_recovers_without_restart_or_late_overwrite(self):
        payload = self.prepare()
        with patch('tracker.review_api.execute_review'):
            response = self.client.post(f'/applications/{self.id}/reviews', json=payload)
        id = response.json()['id']
        with self.client.app.state.sessions() as db:
            db.execute(update(ReviewRun).where(ReviewRun.id == id).values(status='running', created_at=utc_now()-timedelta(minutes=4))); db.commit()
        with patch('tracker.provider.generate') as generate:
            recovered = self.client.get('/reviews/' + id).json()
            self.assertEqual(recovered['status'], 'uncertain'); generate.assert_not_called()
        save_outcome(self.client.app.state.sessions, id, {'status': 'succeeded', 'finished_at': utc_now()})
        self.assertEqual(self.client.get('/reviews/' + id).json()['status'], 'uncertain')
        outcome = next(e for e in self.events() if e['id'] == 'review-outcome:' + id)
        self.assertIn('detected', outcome['title'])

    def test_apply_waits_for_concurrent_decision_then_rejects_stale_accept(self):
        run = self.run_review(self.prepare())
        accepted = self.client.post(f'/reviews/{run["id"]}/events', json={'id': uid(), 'kind': 'decision', 'target_id': 'v1', 'decision': 'accept', 'confirmed_facts': True}).json()
        with self.client.app.state.sessions() as db, ThreadPoolExecutor(max_workers=1) as pool:
            db.connection().exec_driver_sql('BEGIN IMMEDIATE')
            db.add(ReviewEvent(id=uid(), review_id=run['id'], kind='decision', target_id='v1', payload={'decision': 'reject', 'answer': None, 'text': None, 'confirmed_facts': False}))
            started = threading.Event()
            def apply():
                started.set()
                return self.client.post(f'/reviews/{run["id"]}/apply', json={'id': uid(), 'event_ids': [accepted['id']]})
            future = pool.submit(apply); started.wait(2); time.sleep(.05)
            db.commit()
            result = future.result(timeout=10)
        self.assertEqual(result.status_code, 409)
        self.assertEqual(len(self.client.get(f'/applications/{self.id}/workspace').json()['documents']), 2)

    def test_concurrent_decision_replays_do_not_duplicate_history(self):
        run = self.run_review(self.prepare())
        payload = {'id': uid(), 'kind': 'decision', 'target_id': 'v1', 'decision': 'reject'}
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.client.post(f'/reviews/{run["id"]}/events', json=payload), range(2)))
        self.assertEqual([r.status_code for r in results], [201, 201])
        self.assertEqual(len(self.client.get('/reviews/' + run['id']).json()['events']), 1)

    def test_blank_evidence_and_unusable_ids_are_invalid_output(self):
        payload = self.prepare()
        def invalid(mode, model, resume, job, answers):
            result = provider.mock_output(resume, job)
            result['requirements'][0]['evidence'][0]['quote'] = ' '
            result['revisions'][0]['id'] = ''
            return provider.ProviderResult(result)
        with patch('tracker.provider.generate', side_effect=invalid):
            run = self.run_review(payload)
        self.assertEqual(run['status'], 'invalid_output'); self.assertIsNone(run['result'])

    def test_legacy_blank_names_remain_readable_and_imported_documents_are_immutable(self):
        source, destination = Path(self.temp.name)/'copy.sqlite3', Path(self.temp.name)/'import.sqlite3'
        with closing(sqlite3.connect(source)) as db, db:
            db.execute('CREATE TABLE analyses (id INTEGER, company_name TEXT, job_title TEXT, resume_text TEXT, job_description TEXT)')
            db.execute('INSERT INTO analyses VALUES (1, ?, ?, ?, ?)', ('  ', '\t', 'Synthetic résumé', 'Job'))
        import_copy(source, destination, 'regression', apply=True)
        with closing(sqlite3.connect(destination)) as db, db:
            with self.assertRaises(sqlite3.IntegrityError): db.execute("UPDATE document_versions SET text='overwritten'")
            db.rollback()
            raw = json.loads(db.execute('SELECT raw_record FROM legacy_imports').fetchone()[0])
            self.assertEqual(raw['company_name'], '  ')
        with TestClient(create_app(destination)) as imported:
            rows = imported.get('/applications')
            self.assertEqual(rows.status_code, 200)
            self.assertEqual(rows.json()[0]['company'], 'Legacy company not recorded')
