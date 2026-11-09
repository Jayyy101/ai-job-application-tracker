import json
import time
import logging
from datetime import timedelta
from uuid import UUID, uuid4
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from tracker.documents import digest, make_document, serialize, validate_output
from tracker.models import Application, utc_now
from tracker.review_models import Document, ReviewRun, ReviewEvent, RevisionApplication, LegacyImport
from tracker.review_schema import DocumentCreate, ReviewCreate, EventCreate, ApplyCreate, ReviewOutput
from tracker import provider


def required(db, model, id):
    value = db.get(model, str(id))
    if value is None: raise HTTPException(404, 'This saved item was not found.')
    return value


def review_view(db, run):
    result = serialize(run)
    result.pop('fingerprint')
    # Invalid raw model output is retained for audit, never rendered as a verified review.
    if run.status != 'succeeded': result['result'] = None
    result['events'] = [serialize(e) for e in db.scalars(select(ReviewEvent).where(ReviewEvent.review_id == run.id).order_by(ReviewEvent.created_at, ReviewEvent.id))]
    result['applied_versions'] = [serialize(a) for a in db.scalars(select(RevisionApplication).where(RevisionApplication.review_id == run.id))]
    return result


def expire_unfinished(db, run):
    # A worker can disappear or fail to persist after a call. Never leave the UI
    # polling forever or infer that the provider did not charge the request.
    if run.status in ('queued', 'running') and run.created_at.replace(tzinfo=None) < (utc_now() - timedelta(minutes=3)).replace(tzinfo=None):
        db.execute(update(ReviewRun).where(ReviewRun.id == run.id, ReviewRun.status.in_(['queued', 'running'])).values(
            status='uncertain', error='No completion was saved within the review window. The provider outcome is unknown. No automatic retry was sent.', finished_at=utc_now()))
        db.commit()
        db.refresh(run)
    return run


def save_outcome(sessions, run_id, values):
    with sessions() as db:
        db.connection().exec_driver_sql('BEGIN IMMEDIATE')
        # Do not let a late worker overwrite an interruption recorded by recovery.
        db.execute(update(ReviewRun).where(ReviewRun.id == run_id, ReviewRun.status == 'running').values(**values))
        db.commit()


def execute_review(sessions, run_id):
    with sessions() as db:
        claim = db.execute(update(ReviewRun).where(ReviewRun.id == run_id, ReviewRun.status == 'queued').values(status='running'))
        db.commit()
        if not claim.rowcount: return
        run = db.get(ReviewRun, run_id)
        resume, job = db.get(Document, run.resume_id), db.get(Document, run.job_id)
        # All input objects are loaded, then detached. No database lock is held
        # while waiting for a provider.
    start = time.monotonic()
    values = {}
    try:
        reply = provider.generate(run.mode, run.model_requested, resume, job, run.input_snapshot['clarifications'])
        values.update(model_returned=reply.model, usage=reply.usage, provider_response_id=reply.response_id, result=reply.output)
        parsed = ReviewOutput.model_validate(reply.output).model_dump()
        issues = validate_output(parsed, resume, job, {a['event_id']: a['answer'] for a in run.input_snapshot['clarifications']})
        values.update(result=parsed, validation_issues=issues, status='invalid_output' if issues else 'succeeded')
        if issues: values['error'] = 'The response failed source or revision checks. Its suggestions are quarantined; no citations are shown as verified.'
    except provider.ProviderFailure as error:
        values.update(error.metadata)
        values.update(status='uncertain' if error.uncertain else 'failed', error=str(error))
    except Exception:
        values.update(status='invalid_output', error='The provider response could not be validated. No successful review was substituted.')
    values.update(latency_ms=round((time.monotonic() - start) * 1000), finished_at=utc_now())
    try:
        save_outcome(sessions, run_id, values)
    except SQLAlchemyError:
        # A failed result commit must never cause another paid call. Persist a
        # minimal uncertainty marker if possible; GET recovery handles an outage.
        try:
            save_outcome(sessions, run_id, {'status': 'uncertain', 'error': 'The provider may have completed, but its result could not be saved. No automatic retry was sent.', 'finished_at': utc_now()})
        except SQLAlchemyError:
            logging.getLogger(__name__).error('Review result storage unavailable; saved request requires recovery. No provider retry.')


def router(session):
    api = APIRouter()

    @api.get('/review-config')
    def config(): return provider.configuration()

    @api.get('/applications/{application_id}/workspace')
    def workspace(application_id: UUID, db=Depends(session)):
        required(db, Application, application_id)
        docs = db.scalars(select(Document).where(Document.application_id == str(application_id)).order_by(Document.created_at.desc(), Document.id)).all()
        runs = db.scalars(select(ReviewRun).where(ReviewRun.application_id == str(application_id)).order_by(ReviewRun.created_at.desc())).all()
        legacy = db.scalars(select(LegacyImport).where(LegacyImport.application_id == str(application_id))).all()
        return {'documents': [serialize(d) for d in docs], 'reviews': [review_view(db, expire_unfinished(db, r)) for r in runs],
                'legacy': [serialize(l) for l in legacy], 'config': provider.configuration()}

    @api.post('/applications/{application_id}/documents', status_code=201)
    def save_document(application_id: UUID, body: DocumentCreate, db=Depends(session)):
        required(db, Application, application_id)
        if body.parent_id:
            parent = required(db, Document, body.parent_id)
            if parent.application_id != str(application_id) or parent.kind != body.kind:
                raise HTTPException(422, 'The parent must be the same application and document kind.')
        existing = db.get(Document, str(body.id))
        if existing:
            if (existing.application_id, existing.kind, existing.label, existing.text, existing.parent_id) != (str(application_id), body.kind, body.label, body.text, str(body.parent_id) if body.parent_id else None):
                raise HTTPException(409, 'That version ID is already saved with different content. Reload the version list.')
            return serialize(existing)
        record = make_document(str(body.id), str(application_id), body.kind, body.label, body.text, str(body.parent_id) if body.parent_id else None)
        db.add(record); db.commit()
        return serialize(record)

    @api.post('/applications/{application_id}/reviews', status_code=202)
    def request_review(application_id: UUID, body: ReviewCreate, background: BackgroundTasks, request: Request, db=Depends(session)):
        required(db, Application, application_id)
        resume, job = required(db, Document, body.resume_id), required(db, Document, body.job_id)
        if resume.application_id != str(application_id) or job.application_id != str(application_id) or resume.kind != 'resume' or job.kind != 'job':
            raise HTTPException(422, 'Select a résumé and job version from this application.')
        answers = []
        for id in sorted(set(str(x) for x in body.clarification_event_ids)):
            event = required(db, ReviewEvent, id)
            previous = required(db, ReviewRun, event.review_id)
            if previous.application_id != str(application_id) or event.kind != 'clarification':
                raise HTTPException(422, 'Clarifications must belong to this application.')
            question = next(q['question'] for q in previous.result['clarifications'] if q['id'] == event.target_id)
            answers.append({'event_id': id, 'question': question, 'answer': event.payload['answer'], 'origin': 'user_supplied_unverified'})
        retry_id = str(body.retry_of) if body.retry_of else None
        snapshot = {'resume_id': resume.id, 'job_id': job.id, 'clarifications': answers, 'retry_of': retry_id}
        existing = db.get(ReviewRun, str(body.id))
        if existing:
            if existing.application_id != str(application_id) or existing.input_snapshot != snapshot:
                raise HTTPException(409, 'This request ID already belongs to different inputs.')
            return review_view(db, existing)
        config = provider.configuration()
        fingerprint = digest(json.dumps([str(application_id), snapshot, config['mode'], config['model'], provider.PROMPT_HASH], sort_keys=True))
        existing = db.scalar(select(ReviewRun).where(ReviewRun.fingerprint == fingerprint))
        if existing: return review_view(db, existing)
        if retry_id:
            previous = required(db, ReviewRun, retry_id)
            if previous.application_id != str(application_id) or previous.status not in ('failed', 'uncertain', 'invalid_output') or not body.acknowledge_new_request:
                raise HTTPException(409, 'A new attempt requires an unsuccessful review and explicit acknowledgment that another request may incur a charge.')
        if (body.expected_mode, body.expected_model) != (config['mode'], config['model']):
            raise HTTPException(409, 'Review configuration changed. Reload the workspace and acknowledge the current provider before requesting a review.')
        if not config['ready']: raise HTTPException(409, config['message'])
        record = ReviewRun(id=str(body.id), application_id=str(application_id), resume_id=resume.id, job_id=job.id,
            fingerprint=fingerprint, status='queued', mode=config['mode'], model_requested=config['model'],
            prompt_version=provider.PROMPT_VERSION, schema_version=provider.SCHEMA_VERSION, prompt_hash=provider.PROMPT_HASH,
            input_snapshot=snapshot)
        db.add(record)
        try: db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.scalar(select(ReviewRun).where(ReviewRun.fingerprint == fingerprint))
            if existing: return review_view(db, existing)
            raise HTTPException(409, 'This request ID was already used.') from None
        background.add_task(execute_review, request.app.state.sessions, record.id)
        return review_view(db, record)

    @api.get('/reviews/{review_id}')
    def get_review(review_id: UUID, db=Depends(session)):
        return review_view(db, expire_unfinished(db, required(db, ReviewRun, review_id)))

    @api.post('/reviews/{review_id}/events', status_code=201)
    def add_event(review_id: UUID, body: EventCreate, db=Depends(session)):
        run = required(db, ReviewRun, review_id)
        if run.status != 'succeeded': raise HTTPException(409, 'Only a validated completed review can receive decisions or answers.')
        payload = body.model_dump(mode='json', exclude={'id', 'kind', 'target_id'})
        existing = db.get(ReviewEvent, str(body.id))
        if existing:
            if (existing.review_id, existing.kind, existing.target_id, existing.payload) != (str(review_id), body.kind, body.target_id, payload):
                raise HTTPException(409, 'This saved event ID has different content.')
            return serialize(existing)
        if body.kind == 'clarification':
            if not any(q['id'] == body.target_id for q in run.result['clarifications']) or not body.answer or not body.answer.strip():
                raise HTTPException(422, 'Select a review question and provide an answer.')
        else:
            revision = next((r for r in run.result['revisions'] if r['id'] == body.target_id), None)
            if not revision or not body.decision: raise HTTPException(422, 'Select a suggestion and decision.')
            if body.decision != 'reject' and not body.confirmed_facts: raise HTTPException(422, 'Confirm that you checked the wording and its facts before saving this decision.')
            if body.decision == 'edit' and (not body.text or not body.text.strip()): raise HTTPException(422, 'Enter your replacement text.')
        event = ReviewEvent(id=str(body.id), review_id=str(review_id), kind=body.kind, target_id=body.target_id, payload=payload)
        db.add(event); db.commit()
        return serialize(event)

    @api.post('/reviews/{review_id}/apply', status_code=201)
    def apply_revisions(review_id: UUID, body: ApplyCreate, db=Depends(session)):
        run = required(db, ReviewRun, review_id)
        if run.status != 'succeeded': raise HTTPException(409, 'This review has no applicable validated suggestions.')
        event_ids = sorted(set(str(x) for x in body.event_ids))
        fingerprint = digest(json.dumps([run.id, event_ids]))
        same_id = db.get(RevisionApplication, str(body.id))
        if same_id and same_id.fingerprint != fingerprint: raise HTTPException(409, 'This apply request ID has different decisions.')
        existing = db.scalar(select(RevisionApplication).where(RevisionApplication.fingerprint == fingerprint))
        if existing: return serialize(required(db, Document, existing.document_id))
        source = required(db, Document, run.resume_id)
        edits, targets = [], set()
        for id in event_ids:
            event = required(db, ReviewEvent, id)
            if event.review_id != run.id or event.kind != 'decision' or event.payload['decision'] == 'reject':
                raise HTTPException(422, 'Only accepted or edited decisions from this review can be applied.')
            latest = db.scalar(select(ReviewEvent).where(ReviewEvent.review_id == run.id, ReviewEvent.kind == 'decision', ReviewEvent.target_id == event.target_id).order_by(ReviewEvent.created_at.desc(), ReviewEvent.id.desc()))
            if latest.id != event.id: raise HTTPException(409, 'A decision changed. Refresh the review before applying.')
            revision = next(r for r in run.result['revisions'] if r['id'] == event.target_id)
            passage = next(p for p in source.passages if p['id'] == revision['source']['passage_id'])
            if passage['id'] in targets: raise HTTPException(422, 'These decisions overlap.')
            targets.add(passage['id'])
            replacement = event.payload['text'] if event.payload['decision'] == 'edit' else revision['proposed']
            edits.append((passage['start'], passage['end'], replacement))
        text = source.text
        for start, end, replacement in sorted(edits, reverse=True): text = text[:start] + replacement + text[end:]
        if len(text) > 30000: raise HTTPException(422, 'The revised résumé exceeds 30,000 characters.')
        doc = make_document(str(uuid4()), run.application_id, 'resume', f'Revised from {source.label}'[:120], text, source.id, 'review_decisions')
        db.add(doc); db.flush()
        db.add(RevisionApplication(id=str(body.id), review_id=run.id, fingerprint=fingerprint, document_id=doc.id, event_ids=event_ids))
        try: db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.scalar(select(RevisionApplication).where(RevisionApplication.fingerprint == fingerprint))
            if existing: return serialize(required(db, Document, existing.document_id))
            raise HTTPException(409, 'This apply request was already used.') from None
        return serialize(doc)

    return api
