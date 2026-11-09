from datetime import date, datetime, timezone
from enum import Enum
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ApplicationStatus(str, Enum):
    interested = "Interested"
    applied = "Applied"
    interviewing = "Interviewing"
    offer = "Offer"
    rejected = "Rejected"
    withdrawn = "Withdrawn"


class ApplicationFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    company: str = Field(min_length=1, max_length=160)
    role: str = Field(min_length=1, max_length=200)
    status: ApplicationStatus = ApplicationStatus.interested
    job_link: str | None = Field(default=None, max_length=2048)
    job_description: str | None = Field(default=None, max_length=30000)
    notes: str | None = Field(default=None, max_length=10000)
    next_action: str | None = Field(default=None, max_length=240)
    follow_up_date: date | None = None

    @field_validator("job_link", "job_description", "notes", "next_action", mode="before")
    @classmethod
    def empty_to_none(cls, value):
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("job_link")
    @classmethod
    def safe_posting_link(cls, value):
        if value:
            try:
                url = urlsplit(value)
                if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password:
                    raise ValueError()
                _ = url.port
                if any(char.isspace() for char in value) or "\\" in value:
                    raise ValueError()
            except ValueError:
                raise ValueError("Use a full http:// or https:// link without credentials.") from None
        return value


class ApplicationCreate(ApplicationFields):
    # A form keeps this key across retries so a lost response cannot create duplicates.
    id: UUID | None = None


class ApplicationResponse(ApplicationFields):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

    @field_validator("created_at", "updated_at", "archived_at", mode="before")
    @classmethod
    def sqlite_utc(cls, value):
        # SQLite drops timezone metadata; all timestamps in this new table are UTC.
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
