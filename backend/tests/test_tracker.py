"""Isolated contract tests. Run: python -m unittest discover -s tests -v"""
from contextlib import closing
import os
import sqlite3
import sys
import tempfile
import unittest
from network_guard import block_external_network
from datetime import date
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from tracker.api import create_app
from tracker.database import LEGACY_DATABASE, selected_database
from tracker.seed import seed_demo


class TrackerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tracker-api-test-")
        self.path = Path(self.temp.name) / "isolated.sqlite3"
        self.network = block_external_network()
        self.network.start()
        self.client_context = TestClient(create_app(self.path), raise_server_exceptions=False)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        self.network.stop()
        self.temp.cleanup()

    def create(self, **changes):
        return self.client.post("/applications", json={"company": "Synthetic Co", "role": "Developer", **changes})

    def test_company_and_role_are_enough(self):
        result = self.create()
        self.assertEqual(result.status_code, 201)
        row = result.json()
        self.assertEqual(row["status"], "Interested")
        self.assertIsNone(row["notes"])
        self.assertIsNone(row["follow_up_date"])
        self.assertTrue(row["created_at"].endswith(("Z", "+00:00")))
        self.assertNotIn("match_score", row)
        self.assertEqual(self.client.get(f"/applications/{row['id']}").json(), row)

    def test_all_optional_fields_and_whitespace(self):
        result = self.create(company="  Synthetic Co  ", role="  Developer  ", status="Applied", job_link="https://example.com/job", notes="  Note  ", next_action="Follow up", job_description="A synthetic role", follow_up_date="2026-10-26")
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json()["company"], "Synthetic Co")
        self.assertEqual(result.json()["notes"], "Note")

    def test_invalid_inputs_never_save(self):
        cases = [
            {"company": "   "}, {"role": ""}, {"company": None}, {"role": "x" * 201},
            {"status": "Invented"}, {"status": None}, {"follow_up_date": "2026-99-99"},
            {"job_link": "javascript:alert(1)"}, {"job_link": "file:///tmp/example"},
            {"job_link": "not a URL"}, {"job_link": "https://name:password@example.com"},
            {"job_link": "https://exa mple.com"}, {"job_link": "https://example.com:bad"},
            {"job_description": "x" * 30001}, {"notes": "x" * 10001}, {"unknown": "field"},
        ]
        for changes in cases:
            with self.subTest(fields=list(changes)):
                result = self.create(**changes)
                self.assertEqual(result.status_code, 422)
                self.assertIn("fields", result.json()["error"])
                self.assertEqual(set(result.json()["error"]), {"code", "message", "fields"})
        self.assertEqual(self.client.get("/applications").json(), [])

    def test_update_does_not_create_another_application(self):
        row = self.create().json()
        result = self.client.put(f"/applications/{row['id']}", json={"company": "New Synthetic Co", "role": "Developer", "status": "Interviewing", "notes": "Updated", "follow_up_date": "2026-10-27"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["id"], row["id"])
        self.assertEqual(result.json()["created_at"], row["created_at"])
        self.assertEqual(len(self.client.get("/applications").json()), 1)
        self.assertEqual(self.client.put(f"/applications/{row['id']}", json={"company": "New Synthetic Co", "role": "Developer", "notes": "", "follow_up_date": None}).json()["notes"], None)

    def test_invalid_update_preserves_record(self):
        row = self.create(notes="Keep this").json()
        result = self.client.put(f"/applications/{row['id']}", json={"company": "Synthetic Co", "role": "Developer", "status": None})
        self.assertEqual(result.status_code, 422)
        self.assertEqual(self.client.get(f"/applications/{row['id']}").json(), row)

    def test_retry_after_lost_response_is_idempotent(self):
        record_id = str(uuid4())
        first = self.create(id=record_id)
        retry = self.create(id=record_id)
        self.assertEqual(first.json(), retry.json())
        self.assertEqual(len(self.client.get("/applications").json()), 1)
        self.assertEqual(self.create(id=record_id, role="Different role").status_code, 409)

    def test_archive_and_restore_keep_identity_and_content(self):
        row = self.create(notes="Keep me").json()
        archived = self.client.post(f"/applications/{row['id']}/archive").json()
        self.assertIsNotNone(archived["archived_at"])
        self.assertEqual(archived["notes"], "Keep me")
        restored = self.client.post(f"/applications/{row['id']}/restore").json()
        self.assertIsNone(restored["archived_at"])
        self.assertEqual(restored["id"], row["id"])
        self.assertEqual(len(self.client.get("/applications").json()), 1)

    def test_missing_record_and_invalid_id(self):
        self.assertEqual(self.client.get(f"/applications/{uuid4()}").status_code, 404)
        self.assertEqual(self.client.post(f"/applications/{uuid4()}/archive").status_code, 404)
        self.assertEqual(self.client.get("/applications/not-an-id").status_code, 422)

    def test_database_error_is_safe_and_retryable(self):
        with patch.object(Session, "commit", side_effect=OperationalError("private statement", {}, Exception("private detail"))):
            result = self.create()
        self.assertEqual(result.status_code, 503)
        self.assertNotIn("private", str(result.json()))
        self.assertEqual(self.client.get("/applications").json(), [])
        self.assertEqual(self.create().status_code, 201)

    def test_workspace_metadata_and_cors(self):
        self.assertEqual(self.client.get("/health").json()["database"], "isolated.sqlite3")
        self.assertEqual(self.client.get("/health").json()["service"], "application-tracker")
        good = self.client.options("/applications", headers={"Origin": "http://127.0.0.1:43127", "Access-Control-Request-Method": "POST"})
        self.assertEqual(good.status_code, 200)
        bad = self.client.options("/applications", headers={"Origin": "https://unrelated.example", "Access-Control-Request-Method": "POST"})
        self.assertNotEqual(bad.status_code, 200)

    def test_baseline_and_openai_are_not_loaded(self):
        self.assertEqual(self.client.post("/analyze", json={}).status_code, 404)
        self.assertNotIn("app.ai_service", sys.modules)
        # Another test may exercise the mocked SDK. Verify a fresh tracker import
        # stays lazy and cannot load the legacy provider or issue model requests.
        import subprocess
        subprocess.run([sys.executable, '-B', '-c', "import sys; import tracker.api; assert 'openai' not in sys.modules; assert 'app.ai_service' not in sys.modules"], check=True)

    def test_persistence_across_app_restarts(self):
        row = self.create().json()
        with TestClient(create_app(self.path)) as another:
            self.assertEqual(another.get(f"/applications/{row['id']}").json(), row)

    def test_seed_never_replaces_existing_records(self):
        self.create(company="Keep Synthetic Record")
        self.assertEqual(seed_demo(self.path), 0)
        self.assertEqual(self.client.get("/applications").json()[0]["company"], "Keep Synthetic Record")

    def test_seed_only_populates_empty_development_database(self):
        self.assertEqual(seed_demo(self.path, date(2026, 10, 25)), 6)
        self.assertEqual(seed_demo(self.path), 0)
        self.assertEqual(len(self.client.get("/applications").json()), 6)

    def test_database_selection_is_explicit_and_protects_legacy(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                selected_database()
        with self.assertRaises(ValueError):
            selected_database("relative.sqlite3")
        with self.assertRaises(ValueError):
            selected_database(LEGACY_DATABASE)
    def test_legacy_symlink_alias_is_refused(self):
        alias = Path(self.temp.name) / "alias.sqlite3"
        try:
            alias.symlink_to(LEGACY_DATABASE)
        except OSError as error:
            if sys.platform == 'win32' and getattr(error, 'winerror', None) == 1314:
                self.skipTest('Windows symlink privilege unavailable; direct-path protection is tested separately.')
            raise
        with self.assertRaises(ValueError):
            selected_database(alias)

    def test_copied_legacy_database_is_refused(self):
        copied = Path(self.temp.name) / "legacy-copy.sqlite3"
        with closing(sqlite3.connect(copied)) as db, db:
            db.execute("CREATE TABLE analyses (id INTEGER PRIMARY KEY)")
        with self.assertRaises(ValueError):
            with TestClient(create_app(copied)):
                pass

    def test_database_filename_is_not_parsed_as_a_url_query(self):
        special = Path(self.temp.name) / ("exact#filename.sqlite3" if sys.platform == "win32" else "exact?filename.sqlite3")
        with TestClient(create_app(special)) as isolated:
            self.assertEqual(isolated.get("/applications").json(), [])
        self.assertTrue(special.exists())
        self.assertFalse((Path(self.temp.name) / "exact").exists())


if __name__ == "__main__":
    unittest.main()
