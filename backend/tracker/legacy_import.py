"""Explicit offline import from a legacy COPY. No original DB access, no model calls."""
from contextlib import closing
import argparse
import json
import sqlite3
from datetime import date
from pathlib import Path
from uuid import uuid4
from sqlalchemy import select
from tracker.database import initialize_schema, LEGACY_DATABASE, open_database, selected_database
from tracker.models import Application
from tracker.review_models import LegacyImport
from tracker.documents import digest, make_document


def read_copy(source):
    source = Path(source).expanduser().resolve()
    if not source.is_file(): raise ValueError('Select an existing legacy database copy.')
    if source == LEGACY_DATABASE.resolve() or (LEGACY_DATABASE.exists() and source.samefile(LEGACY_DATABASE)):
        raise ValueError('Use a copy, never the protected original database as an import source.')
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        rows = [dict(r) for r in connection.execute('SELECT * FROM analyses ORDER BY id')]
    if any(not {'id', 'resume_text', 'job_description'}.issubset(r) for r in rows):
        raise ValueError('The source does not have the expected legacy columns.')
    return source, rows


def import_copy(source, destination, namespace, apply=False, fail_after=None):
    source, rows = read_copy(source)
    destination = selected_database(destination)
    if source == destination or (destination.exists() and source.samefile(destination)):
        raise ValueError('Source and destination must be different files.')
    if not namespace.strip() or len(namespace) > 120: raise ValueError('Provide a stable source namespace (1–120 characters), reused for future imports from this source.')
    engine, sessions = open_database(destination)
    initialize_schema(engine)
    inserted, skipped = 0, 0
    try:
        with sessions() as db:
            db.connection().exec_driver_sql('BEGIN IMMEDIATE')
            for row in rows:
                raw = json.dumps(row, sort_keys=True, ensure_ascii=False)
                record_hash = digest(raw)
                existing = db.scalar(select(LegacyImport).where(LegacyImport.source_namespace == namespace, LegacyImport.legacy_id == str(row['id'])))
                if existing:
                    if existing.record_hash != record_hash:
                        raise ValueError('An already-imported legacy ID has changed. Import aborted; choose an explicit new namespace to retain both versions.')
                    skipped += 1
                    continue
                id = str(uuid4())
                status = row.get('application_status')
                if status not in ('Interested', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'): status = 'Interested'
                try: follow_up = date.fromisoformat(row['follow_up_date']) if row.get('follow_up_date') else None
                except ValueError: follow_up = None
                # Raw values are retained intact below, including unknown enums and oversized fields.
                from tracker.schemas import ApplicationFields
                link = row.get('job_link')
                try: ApplicationFields(company='Legacy', role='Import', job_link=link)
                except ValueError: link = None
                app = Application(id=id, company=(str(row.get('company_name') or '').strip() or 'Legacy company not recorded')[:160],
                    role=(str(row.get('job_title') or '').strip() or 'Legacy role not recorded')[:200], status=status,
                    job_link=link, notes=(row.get('notes') or '')[:10000] or None, follow_up_date=follow_up)
                db.add(app); db.flush()
                for kind, column in [('resume', 'resume_text'), ('job', 'job_description')]:
                    if row.get(column): db.add(make_document(str(uuid4()), id, kind, f'Legacy #{row["id"]} original', row[column], origin='legacy_unknown_provenance'))
                db.add(LegacyImport(id=str(uuid4()), source_namespace=namespace, legacy_id=str(row['id']), application_id=id, raw_record=row, record_hash=record_hash))
                inserted += 1
                if fail_after is not None and inserted >= fail_after: raise RuntimeError('Injected rehearsal failure; transaction rolls back.')
            if apply: db.commit()
            else: db.rollback()
        return {'source_rows': len(rows), 'would_import' if not apply else 'imported': inserted, 'skipped_unchanged': skipped, 'applied': apply}
    finally:
        engine.dispose()


def backup_destination(destination):
    """Consistent backup BEFORE import. Fresh unique file; no overwrite of prior backups."""
    destination = selected_database(destination)
    if not destination.exists(): return None
    backup = destination.with_name(destination.name + '.before-import-' + str(uuid4()) + '.sqlite3')
    with closing(sqlite3.connect(destination.as_uri() + '?mode=ro', uri=True)) as source, closing(sqlite3.connect(backup)) as target:
        source.backup(target)
    return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-copy', required=True)
    parser.add_argument('--destination', required=True)
    parser.add_argument('--source-namespace', required=True)
    parser.add_argument('--apply', action='store_true', help='Default is transaction-rolled-back dry run')
    args = parser.parse_args()
    read_copy(args.source_copy)
    backup = backup_destination(args.destination) if args.apply else None
    result = import_copy(args.source_copy, args.destination, args.source_namespace, args.apply)
    print(json.dumps({**result, 'recovery_backup': str(backup) if backup else None}, indent=2))


if __name__ == '__main__': main()
