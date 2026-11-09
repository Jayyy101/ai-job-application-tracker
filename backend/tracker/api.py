import os
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from tracker.database import initialize_schema, open_database, selected_database
from tracker.models import Application, utc_now
from tracker.review_api import router
from tracker.review_models import ReviewRun
from tracker.activity import timeline, mutation_receipt, record_transition
from tracker.schemas import ApplicationCreate, ApplicationFields, ApplicationResponse


def create_app(database_path: str | Path | None = None) -> FastAPI:
    path = selected_database(database_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine, sessions = open_database(path)
        initialize_schema(engine)
        with engine.begin() as connection:
            connection.execute(update(ReviewRun).where(ReviewRun.status.in_(['queued', 'running'])).values(
                status='uncertain', error='The server restarted before this request completed. Its provider outcome is unknown; it will not be retried automatically.', finished_at=utc_now()))
        app.state.sessions = sessions
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Application Tracker", version="1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.environ.get("TRACKER_FRONTEND_ORIGIN", "http://127.0.0.1:43127")],
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    def session(request: Request):
        with request.app.state.sessions() as db:
            try:
                if request.method in ('POST', 'PUT'):
                    # Reserve the SQLite writer BEFORE reading mutable state. Keep
                    # provider calls outside this short transaction.
                    db.connection().exec_driver_sql('BEGIN IMMEDIATE')
                yield db
            except Exception:
                db.rollback()
                raise

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request, exc):
        fields = {str(error["loc"][-1]): error["msg"] for error in exc.errors()}
        return JSONResponse(status_code=422, content={"error": {
            "code": "validation_error", "message": "Check the highlighted fields.", "fields": fields,
        }})

    @app.exception_handler(HTTPException)
    async def http_error(_request, exc):
        return JSONResponse(status_code=exc.status_code, content={"error": {
            "code": "request_error", "message": str(exc.detail),
        }})

    @app.exception_handler(SQLAlchemyError)
    async def database_error(_request, _exc):
        return JSONResponse(status_code=503, content={"error": {
            "code": "database_unavailable", "message": "The database is temporarily unavailable. Your inputs are still here; try again.",
        }})

    def find(db: Session, application_id: UUID):
        record = db.get(Application, str(application_id))
        if record is None:
            raise HTTPException(404, "This application was not found.")
        return record

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "application-tracker", "workspace": "development", "database": path.name}

    @app.get("/applications", response_model=list[ApplicationResponse])
    def list_applications(db: Session = Depends(session)):
        return db.scalars(select(Application).order_by(Application.updated_at.desc(), Application.id)).all()

    @app.post("/applications", response_model=ApplicationResponse, status_code=201)
    def create_application(body: ApplicationCreate, db: Session = Depends(session)):
        values = body.model_dump(mode="json", exclude={"id"})
        values["follow_up_date"] = body.follow_up_date
        record_id = str(body.id or uuid4())
        existing = db.get(Application, record_id)
        if existing:
            if any(getattr(existing, key) != value for key, value in values.items()) or existing.archived_at:
                raise HTTPException(409, "This application was already saved. Open it from Applications to make changes.")
            return existing
        record = Application(id=record_id, **values)
        db.add(record)
        db.flush()
        record_transition(db, record.id, 'created', {}, record.created_at)
        db.commit()
        db.refresh(record)
        return record

    @app.get("/applications/{application_id}", response_model=ApplicationResponse)
    def get_application(application_id: UUID, db: Session = Depends(session)):
        return find(db, application_id)

    @app.get("/applications/{application_id}/activity")
    def activity(application_id: UUID, db: Session = Depends(session)):
        return timeline(db, find(db, application_id))

    @app.put("/applications/{application_id}", response_model=ApplicationResponse)
    def update_application(application_id: UUID, body: ApplicationFields, request: Request, db: Session = Depends(session)):
        record = find(db, application_id)
        values = body.model_dump(mode="json")
        values["follow_up_date"] = body.follow_up_date
        if mutation_receipt(db, request, application_id, values): return record
        changed = any(getattr(record, key) != value for key, value in values.items())
        if changed:
            at = utc_now()
            if record.status != values['status']:
                record_transition(db, record.id, 'status', {'from': record.status, 'to': values['status']}, at)
            for key, value in values.items():
                setattr(record, key, value)
            record.updated_at = at
        db.commit()
        db.refresh(record)
        return record

    def set_archived(db: Session, application_id: UUID, archived: bool, request: Request):
        record = find(db, application_id)
        if mutation_receipt(db, request, application_id, {'archived': archived}): return record
        if bool(record.archived_at) != archived:
            at = utc_now()
            record.archived_at = at if archived else None
            record.updated_at = at
            record_transition(db, record.id, 'archive' if archived else 'restore', {}, at)
        db.commit()
        db.refresh(record)
        return record

    @app.post("/applications/{application_id}/archive", response_model=ApplicationResponse)
    def archive(application_id: UUID, request: Request, db: Session = Depends(session)):
        return set_archived(db, application_id, True, request)

    @app.post("/applications/{application_id}/restore", response_model=ApplicationResponse)
    def restore(application_id: UUID, request: Request, db: Session = Depends(session)):
        return set_archived(db, application_id, False, request)

    app.include_router(router(session))
    return app
