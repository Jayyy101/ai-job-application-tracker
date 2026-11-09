"""Persist new tracking transitions; derive older activity only from reliable saved facts."""
import hashlib
import json
from datetime import datetime
from uuid import uuid4, UUID
from fastapi import HTTPException
from sqlalchemy import DateTime, ForeignKey, JSON, String, select
from sqlalchemy.orm import Mapped, mapped_column
from tracker.database import Base
from tracker.models import utc_now
from tracker.review_models import Document, ReviewRun, RevisionApplication, LegacyImport


class ActivityEvent(Base):
    __tablename__ = 'application_activity'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    application_id: Mapped[str] = mapped_column(ForeignKey('applications.id'), index=True)
    kind: Mapped[str] = mapped_column(String)
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class MutationReceipt(Base):
    __tablename__ = 'application_mutation_receipts'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    application_id: Mapped[str] = mapped_column(ForeignKey('applications.id'))
    fingerprint: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


def record_transition(db, application_id, kind, details, at):
    db.add(ActivityEvent(application_id=application_id, kind=kind, details=details, created_at=at))


def mutation_receipt(db, request, application_id, values):
    """Called inside a serialized write transaction. Replays never undo newer edits."""
    key = request.headers.get('X-Request-ID')
    if not key: return False  # Older clients still get no-op deduplication.
    try: key = str(UUID(key))
    except ValueError: raise HTTPException(422, 'X-Request-ID must be a UUID.') from None
    fingerprint = hashlib.sha256(json.dumps([request.method, request.url.path, values], sort_keys=True, default=str).encode()).hexdigest()
    existing = db.get(MutationReceipt, key)
    if existing:
        if existing.application_id != str(application_id) or existing.fingerprint != fingerprint:
            raise HTTPException(409, 'This retry identifier was already used for a different change.')
        return True
    db.add(MutationReceipt(id=key, application_id=str(application_id), fingerprint=fingerprint))
    return False


def timeline(db, app):
    events = []
    def add(id, at, title, detail='', href=None):
        if at is None: return
        timestamp = at if isinstance(at, str) else at.isoformat() + ('+00:00' if at.tzinfo is None else '')
        events.append({'id': id, 'at': timestamp, 'title': title, 'detail': detail, 'href': href})
    legacy = db.scalar(select(LegacyImport).where(LegacyImport.application_id == app.id))
    add('application:' + app.id, app.created_at,
        'Legacy application record imported' if legacy else 'Application created',
        'Import time; original application timing and status history are unknown.' if legacy else '')
    tracking = db.scalars(select(ActivityEvent).where(ActivityEvent.application_id == app.id)).all()
    for event in tracking:
        if event.kind == 'created': continue  # Completeness marker; creation is shown once above.
        title = f'Status: {event.details["from"]} → {event.details["to"]}' if event.kind == 'status' else ('Application archived' if event.kind == 'archive' else 'Application restored')
        add('activity:' + event.id, event.created_at, title)
    # A saved current archive timestamp is reliable. It tells us nothing about prior restores.
    if app.archived_at and not any(e.kind == 'archive' and e.created_at == app.archived_at for e in tracking):
        add('legacy-archive:' + app.id, app.archived_at, 'Application archived', 'From the saved archive timestamp; earlier archive/restore history was not recorded.')
    runs = db.scalars(select(ReviewRun).where(ReviewRun.application_id == app.id)).all()
    applied = db.scalars(select(RevisionApplication).join(ReviewRun).where(ReviewRun.application_id == app.id)).all()
    applied_docs = {a.document_id for a in applied}
    docs = db.scalars(select(Document).where(Document.application_id == app.id)).all()
    for doc in docs:
        if doc.id in applied_docs: continue  # Applying edits is one meaningful event, not two.
        add('document:' + doc.id, doc.created_at, f'{"Résumé" if doc.kind == "resume" else "Job"} version saved', doc.label, '#version-' + doc.id)
    for run in runs:
        label = 'Mock review' if run.mode == 'mock' else 'AI review'
        href = f'/applications/{app.id}/review?run={run.id}'
        add('review-request:' + run.id, run.created_at, label + ' requested', '', href)
        if run.finished_at:
            title = {'succeeded': 'completed', 'invalid_output': 'rejected by validation', 'failed': 'failed', 'uncertain': 'outcome unknown (detected)'}.get(run.status)
            if title: add('review-outcome:' + run.id, run.finished_at, label + ' ' + title, '', href)
    for item in applied:
        doc = next((d for d in docs if d.id == item.document_id), None)
        add('applied:' + item.id, item.created_at, 'Revisions applied as a new résumé version', doc.label if doc else '', '#version-' + item.document_id)
    events.sort(key=lambda e: (e['at'], e['id']), reverse=True)
    return {'events': events, 'history_note': '' if any(e.kind == 'created' for e in tracking) else 'This record predates complete activity tracking or was imported. Earlier status changes and restores may be missing. Only saved timestamps are shown.'}
