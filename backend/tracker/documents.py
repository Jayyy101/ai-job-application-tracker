import hashlib
import re
from datetime import timezone
from tracker.review_models import Document


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def make_document(id, application_id, kind, label, text, parent_id=None, origin='pasted'):
    # Each nonblank line retains its exact Unicode offsets and text. Never normalize a quote.
    passages = [{'id': f'{id}:p{i+1}', 'start': m.start(), 'end': m.end(), 'text': m.group()}
                for i, m in enumerate(re.finditer(r'[^\r\n]+', text)) if m.group().strip()]
    return Document(id=id, application_id=application_id, kind=kind, label=label, text=text,
                    parent_id=parent_id, origin=origin, content_hash=digest(text), passages=passages)


def serialize(record):
    result = {c.name: getattr(record, c.name) for c in record.__table__.columns}
    for key, value in result.items():
        if hasattr(value, 'isoformat'):
            result[key] = value.replace(tzinfo=timezone.utc).isoformat() if value.tzinfo is None else value.isoformat()
    return result


def validate_output(result, resume, job, answers):
    issues = []
    def cite(citation, document, context, whole=False):
        passage = next((p for p in document.passages if p['id'] == citation['passage_id']), None)
        if citation['document_id'] != document.id or not passage or citation['quote'] not in passage['text'] or (whole and citation['quote'] != passage['text']):
            issues.append(f'{context}: source reference or exact quotation is invalid.')
    for collection in ('requirements', 'clarifications', 'revisions'):
        ids = [x['id'] for x in result[collection]]
        if len(set(ids)) != len(ids): issues.append(f'{collection}: duplicate identifiers.')
    requirements = {r['id'] for r in result['requirements']}
    for r in result['requirements']:
        cite(r['job_evidence'], job, 'Requirement')
        for evidence in r['evidence']: cite(evidence, resume, 'Evidence')
        if r['assessment'] != 'not_evidenced' and not r['evidence']:
            issues.append('A supported or partially supported assessment needs résumé evidence.')
    for q in result['clarifications']:
        if q['requirement_id'] is not None and q['requirement_id'] not in requirements:
            issues.append('Clarification refers to an unknown requirement.')
    used_passages = set()
    for r in result['revisions']:
        cite(r['source'], resume, 'Revision', whole=True)
        if r['source']['passage_id'] in used_passages: issues.append('Revisions overlap on the same passage.')
        used_passages.add(r['source']['passage_id'])
        if any(x not in answers for x in r['clarification_ids']): issues.append('Revision uses an unanswered clarification.')
        # Numeric additions can be rejected mechanically. Semantic faithfulness still needs human review.
        facts = r['source']['quote'] + ' ' + ' '.join(answers.get(x, '') for x in r['clarification_ids'])
        numbers = set(re.findall(r'\d+(?:[.,]\d+)*%?', r['proposed']))
        if not numbers.issubset(set(re.findall(r'\d+(?:[.,]\d+)*%?', facts))):
            issues.append('Revision introduces a number not present in its cited source or supplied answers.')
    return list(dict.fromkeys(issues))
