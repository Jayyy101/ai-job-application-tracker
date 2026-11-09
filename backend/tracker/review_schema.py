from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Citation(Strict):
    document_id: str
    passage_id: str
    quote: str = Field(min_length=1, max_length=12000)

    @field_validator('quote')
    @classmethod
    def meaningful_quote(cls, value):
        if not value.strip(): raise ValueError('A citation must contain nonblank source text.')
        return value


class Requirement(Strict):
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{1,80}$')
    text: str
    importance: Literal['required', 'preferred', 'unspecified']
    job_evidence: Citation
    assessment: Literal['supported', 'partially_supported', 'not_evidenced']
    explanation: str
    experience_context: Literal['professional', 'project', 'coursework', 'mixed', 'unspecified']
    evidence: list[Citation]


class Clarification(Strict):
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{1,80}$')
    question: str
    requirement_id: str | None


class Revision(Strict):
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{1,80}$')
    source: Citation
    proposed: str = Field(min_length=1, max_length=12000)
    rationale: str
    clarification_ids: list[str]


class ReviewOutput(Strict):
    summary: str
    requirements: list[Requirement] = Field(min_length=1, max_length=60)
    clarifications: list[Clarification] = Field(max_length=20)
    revisions: list[Revision] = Field(max_length=30)


class DocumentCreate(Strict):
    id: UUID
    kind: Literal['resume', 'job']
    label: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=30000)
    parent_id: UUID | None = None

    @field_validator('text', 'label')
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError('Enter text before saving this version.')
        return value


class ReviewCreate(Strict):
    id: UUID
    expected_mode: Literal['mock', 'openai']
    expected_model: str | None
    resume_id: UUID
    job_id: UUID
    clarification_event_ids: list[UUID] = Field(default_factory=list, max_length=40)
    retry_of: UUID | None = None
    acknowledge_new_request: bool = False


class EventCreate(Strict):
    id: UUID
    kind: Literal['clarification', 'decision']
    target_id: str = Field(min_length=1, max_length=150)
    answer: str | None = Field(default=None, max_length=4000)
    decision: Literal['accept', 'edit', 'reject'] | None = None
    text: str | None = Field(default=None, max_length=12000)
    confirmed_facts: bool = False


class ApplyCreate(Strict):
    id: UUID
    event_ids: list[UUID] = Field(min_length=1, max_length=30)
