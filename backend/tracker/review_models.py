"""Append-only document and review records; existing application rows are unchanged."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from tracker.database import Base
from tracker.models import utc_now


class Document(Base):
    __tablename__ = 'document_versions'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    application_id: Mapped[str] = mapped_column(ForeignKey('applications.id'), index=True)
    kind: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)
    text: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String)
    passages: Mapped[list] = mapped_column(JSON)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey('document_versions.id'))
    origin: Mapped[str] = mapped_column(String, default='pasted')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ReviewRun(Base):
    __tablename__ = 'review_runs'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    application_id: Mapped[str] = mapped_column(ForeignKey('applications.id'), index=True)
    resume_id: Mapped[str] = mapped_column(ForeignKey('document_versions.id'))
    job_id: Mapped[str] = mapped_column(ForeignKey('document_versions.id'))
    fingerprint: Mapped[str] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String)
    mode: Mapped[str] = mapped_column(String)
    model_requested: Mapped[str | None] = mapped_column(String)
    model_returned: Mapped[str | None] = mapped_column(String)
    prompt_version: Mapped[str | None] = mapped_column(String)
    schema_version: Mapped[str | None] = mapped_column(String)
    prompt_hash: Mapped[str | None] = mapped_column(String)
    input_snapshot: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict | None] = mapped_column(JSON)
    validation_issues: Mapped[list | None] = mapped_column(JSON)
    usage: Mapped[dict | None] = mapped_column(JSON)
    provider_response_id: Mapped[str | None] = mapped_column(String)
    latency_ms: Mapped[int | None]
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReviewEvent(Base):
    __tablename__ = 'review_events'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    review_id: Mapped[str] = mapped_column(ForeignKey('review_runs.id'), index=True)
    kind: Mapped[str] = mapped_column(String)
    target_id: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class RevisionApplication(Base):
    __tablename__ = 'revision_applications'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    review_id: Mapped[str] = mapped_column(ForeignKey('review_runs.id'))
    fingerprint: Mapped[str] = mapped_column(String, unique=True)
    document_id: Mapped[str] = mapped_column(ForeignKey('document_versions.id'))
    event_ids: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class LegacyImport(Base):
    __tablename__ = 'legacy_imports'
    __table_args__ = (UniqueConstraint('source_namespace', 'legacy_id'),)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    source_namespace: Mapped[str] = mapped_column(String)
    legacy_id: Mapped[str] = mapped_column(String)
    application_id: Mapped[str] = mapped_column(ForeignKey('applications.id'))
    raw_record: Mapped[dict] = mapped_column(JSON)
    record_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
