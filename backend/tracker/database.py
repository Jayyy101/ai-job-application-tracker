import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, event, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


LEGACY_DATABASE = Path(__file__).resolve().parents[1] / "job_tracker.db"


def selected_database(value: str | Path | None = None) -> Path:
    raw = value or os.environ.get("TRACKER_DATABASE_PATH")
    if not raw:
        raise ValueError("Set TRACKER_DATABASE_PATH to an absolute development SQLite path.")
    path = Path(raw).expanduser()
    if not path.is_absolute():
        raise ValueError("TRACKER_DATABASE_PATH must be absolute.")
    path = path.resolve()
    if path == LEGACY_DATABASE.resolve() or (
        path.exists() and LEGACY_DATABASE.exists() and path.samefile(LEGACY_DATABASE)
    ):
        raise ValueError("The legacy job_tracker.db is protected. Select a separate development database.")
    if path.suffix not in {".db", ".sqlite", ".sqlite3"}:
        raise ValueError("Use a .db, .sqlite, or .sqlite3 development database.")
    return path


def open_database(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        URL.create("sqlite", database=str(path)), connect_args={"check_same_thread": False, "timeout": 5}
    )
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")
    # Also refuse a copied legacy database; this service never migrates old records.
    if "analyses" in inspect(engine).get_table_names():
        engine.dispose()
        raise ValueError("This database contains legacy analyses. Use a separate development database.")
    return engine, sessionmaker(bind=engine, expire_on_commit=False)


def initialize_schema(engine):
    # Used by the API, seeds and importer, so immutable history is protected even
    # before an imported workspace is first opened by the server.
    from tracker import activity, review_models  # noqa: F401
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        for table in ('document_versions', 'review_events', 'revision_applications', 'legacy_imports', 'application_activity', 'application_mutation_receipts'):
            for action in ('UPDATE', 'DELETE'):
                connection.execute(text(f"CREATE TRIGGER IF NOT EXISTS immutable_{table}_{action.lower()} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT, 'Append-only history'); END"))
