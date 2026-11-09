"""Opt-in synthetic walkthrough; never invokes a provider or replaces saved content."""
from uuid import uuid5, NAMESPACE_URL
from tracker.database import initialize_schema, open_database
from tracker.models import Application
from tracker.review_models import Document
from tracker.documents import make_document
from tracker.provider import DEMO_JOB, DEMO_RESUME


def seed_review(path):
    engine, sessions = open_database(path)
    initialize_schema(engine)
    id = str(uuid5(NAMESPACE_URL, 'jobfolio:synthetic-review-walkthrough'))
    with sessions() as db:
        if not db.get(Application, id):
            db.add(Application(id=id, company='Portfolio Example · synthetic', role='Frontend Developer', notes='Fixed synthetic documents for the mock review walkthrough. No real applicant data.'))
            db.flush()
            for kind, text in [('resume', DEMO_RESUME), ('job', DEMO_JOB)]:
                db.add(make_document(str(uuid5(NAMESPACE_URL, 'jobfolio:walkthrough:' + kind)), id, kind, 'Synthetic original', text, origin='synthetic'))
            db.commit()
    engine.dispose()
    return id
