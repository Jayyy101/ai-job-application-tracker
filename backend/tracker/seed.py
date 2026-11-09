"""Opt-in, synthetic-only seeding. Never replace or clear existing records."""
from datetime import date, timedelta
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import func, select

from tracker.database import initialize_schema, open_database, selected_database
from tracker.models import Application


def seed_demo(database_path, today: date | None = None) -> int:
    today = today or date.today()
    engine, sessions = open_database(selected_database(database_path))
    try:
        initialize_schema(engine)
        with sessions() as db:
            if db.scalar(select(func.count()).select_from(Application)):
                return 0
            examples = [
                ("Northstar Labs", "Junior Frontend Engineer", "Interviewing", "Prepare two project walkthroughs", 0),
                ("Fern & Field", "Software Engineer I", "Applied", "Send a short follow-up", -2),
                ("Orbit Studio", "Frontend Developer", "Interested", "Read the role and tailor my résumé", 3),
                ("Common Ground", "Full Stack Developer", "Applied", "Check in with the recruiting team", 5),
                ("Lumen Works", "Graduate Software Engineer", "Offer", "Review the offer details", 2),
                ("Harbor Systems", "Junior Python Developer", "Rejected", None, None),
            ]
            for index, (company, role, status, action, offset) in enumerate(examples):
                db.add(Application(
                    id=str(uuid5(NAMESPACE_URL, f"tracker-synthetic-application-{index}")),
                    company=company, role=role, status=status, next_action=action,
                    follow_up_date=today + timedelta(days=offset) if offset is not None else None,
                    job_link=f"https://example.com/roles/{index + 1}",
                    notes="Synthetic example for the development workspace. No real application or employer data.",
                    job_description="Synthetic posting: build accessible interfaces, work with APIs, and communicate clearly. Python or TypeScript project experience is welcome.",
                ))
            db.commit()
            return len(examples)
    finally:
        engine.dispose()
