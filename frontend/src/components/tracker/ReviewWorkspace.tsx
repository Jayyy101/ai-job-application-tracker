"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trackerApi } from "@/lib/tracker-api";
import type { Application } from "@/types/application";
import type { Citation, DocumentVersion, ReviewEvent, ReviewRun, Revision, Workspace } from "@/types/review";
import { PageHeading } from "./ui";
import { RemoteState, useRemote } from "./remote";

export function ReviewWorkspace({ applicationId, initialRun }: { applicationId: string; initialRun?: string }) {
  const remote = useRemote<Workspace>(`/applications/${applicationId}/workspace`);
  const application = useRemote<Application>(`/applications/${applicationId}`);
  return <><Link className="back-link" href={`/applications/${applicationId}`}>← Application details & documents</Link>
    <RemoteState loading={remote.loading || application.loading} error={remote.error || application.error} retry={() => { remote.reload(); application.reload(); }} />
    {remote.data && application.data && <WorkspaceContent application={application.data} initial={remote.data} initialRun={initialRun} />}</>;
}

function WorkspaceContent({ application, initial, initialRun }: { application: Application; initial: Workspace; initialRun?: string }) {
  const initialReview = initial.reviews.find(r => r.id === initialRun) || initial.reviews[0];
  const [workspace, setWorkspace] = useState(initial);
  const [resumeId, setResumeId] = useState(initialReview?.resume_id || initial.documents.find(d => d.kind === "resume")?.id || "");
  const [jobId, setJobId] = useState(initialReview?.job_id || initial.documents.find(d => d.kind === "job")?.id || "");
  const [run, setRun] = useState<ReviewRun | undefined>(initial.reviews.find(r => r.id === initialRun) || initial.reviews[0]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [consent, setConsent] = useState(false); const [includeAnswers, setIncludeAnswers] = useState(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  const active = run?.status === "queued" || run?.status === "running";
  async function refreshRun(id: string) {
    const value = await trackerApi<ReviewRun>(`/reviews/${id}`); setRun(value);
    setWorkspace(w => ({ ...w, reviews: [value, ...w.reviews.filter(r => r.id !== id)] }));
    return value;
  }
  useEffect(() => {
    if (!active || !run) return;
    let ignore = false;
    const timer = setInterval(() => {
      trackerApi<ReviewRun>(`/reviews/${run.id}`).then(value => {
        if (!ignore) { setRun(value); setError(""); setWorkspace(w => ({ ...w, reviews: [value, ...w.reviews.filter(r => r.id !== value.id)] })); }
      }).catch((e: Error) => { if (!ignore) setError(`${e.message} Use Check saved request; no new provider request will be sent.`); });
    }, 2000);
    return () => { ignore = true; clearInterval(timer); };
  }, [active, run]);
  async function requestReview(retry = false) {
    setBusy(true); setError("");
    const latestAnswers = new Map<string, ReviewEvent>();
    if (includeAnswers && run) run.events.filter(e => e.kind === "clarification").forEach(e => latestAnswers.set(e.target_id, e));
    const fields = { expected_mode: workspace.config.mode, expected_model: workspace.config.model, resume_id: resumeId, job_id: jobId, clarification_event_ids: [...latestAnswers.values()].map(e => e.id), retry_of: retry ? run?.id : null, acknowledge_new_request: retry && consent };
    const key = JSON.stringify(fields);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    const pending = { ...fields, id: request.current.id };
    // Persist the request identity before sending. Reloading cannot silently create another paid attempt.
    try {
      localStorage.setItem(`jobfolio-review-request:${application.id}`, JSON.stringify(pending));
      const value = await trackerApi<ReviewRun>(`/applications/${application.id}/reviews`, { method: "POST", body: JSON.stringify(pending) });
      setRun(value); setConsent(false);
      localStorage.setItem(`jobfolio-review-request:${application.id}`, JSON.stringify({ ...pending, id: value.id }));
      setWorkspace(w => ({ ...w, reviews: [value, ...w.reviews.filter(r => r.id !== value.id)] }));
      window.history.replaceState(null, "", `?run=${value.id}`);
    } catch (e) { setError(`${(e as Error).message} Saved inputs are unchanged. Check the saved request before starting another attempt.`); }
    finally { setBusy(false); }
  }
  async function recover() {
    setBusy(true); setError("");
    try {
      const pending = localStorage.getItem(`jobfolio-review-request:${application.id}`);
      if (pending) {
        const saved = JSON.parse(pending);
        const value = await trackerApi<ReviewRun>(`/reviews/${saved.id}`);
        if (value.application_id !== application.id) throw new Error("The pending request belongs to another application.");
        setRun(value); setWorkspace(w => ({ ...w, reviews: [value, ...w.reviews.filter(r => r.id !== value.id)] })); window.history.replaceState(null, "", `?run=${value.id}`);
      } else if (run) await refreshRun(run.id);
      else setError("No pending request on this browser. Saved reviews are listed below.");
    } catch (e) { setError(`${(e as Error).message} No provider request was sent by this check. If no run exists, use the explicit review action with the same selected inputs.`); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (run?.status === "succeeded") document.getElementById("review-result")?.focus();
  }, [run?.id, run?.status]);
  const ready = !!resumeId && !!jobId;
  return <>
    <PageHeading eyebrow="RÉSUMÉ REVIEW" title="Make your evidence clear." description={`${application.role} · ${application.company}`} action={false} />
    <div className="notice" role="status"><strong>{workspace.config.mode === "mock" ? "Synthetic mock mode" : workspace.config.mode === "openai" ? "Real provider · explicit requests only" : "Provider not enabled"}</strong><p>{workspace.config.mode === "mock" ? "Fixed synthetic example only. No AI calls or charges. These reviews are saved with this application." : workspace.config.message}</p></div>
    <details className="panel detail-panel review-request" open={!run?.result} key={run?.id || "new"}><summary>{run?.result ? "Start another review or check its inputs" : "Choose documents for a review"}</summary><p className="preview-note">Uses these saved versions. Nothing runs until you request it.</p>
      {!ready && <p className="notice">Add both documents in <Link className="text-link" href={`/applications/${application.id}`}>Application details</Link> to request a review.</p>}
      <div className="review-selectors">{(["resume", "job"] as const).map(kind => <div className="field" key={kind}><label htmlFor={`select-${kind}`}>{kind === "resume" ? "Résumé version" : "Job snapshot"}</label><select id={`select-${kind}`} value={kind === "resume" ? resumeId : jobId} disabled={busy || active} onChange={e => { (kind === "resume" ? setResumeId : setJobId)(e.target.value); setConsent(false); }}><option value="">Select a saved version</option>{workspace.documents.filter(d => d.kind === kind).map(d => <option key={d.id} value={d.id}>{d.label} · {new Date(d.created_at).toLocaleString()}</option>)}</select></div>)}</div>
      {run?.events.some(e => e.kind === "clarification") && <label className="check-label"><input type="checkbox" checked={includeAnswers} onChange={e => { setIncludeAnswers(e.target.checked); setConsent(false); }} />Include latest saved answers from the displayed review (user-supplied, unverified)</label>}
      <label className="check-label"><input id="review-consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{workspace.config.mode === "openai" ? "Send these versions and selected answers to OpenAI. This action may incur a charge." : "Use the synthetic mock. No AI call or charge."}</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button" disabled={!ready || !consent || busy || active || !workspace.config.ready} onClick={() => requestReview(!!run && !run.result && !active)}>{busy ? "Saving request…" : run && !run.result && !active ? "Start a new attempt" : workspace.config.mode === "mock" ? "Request mock review" : "Request AI review"}</button>{(error || active) && <button className="button secondary" disabled={busy} onClick={recover}>Check saved request</button>}</div>
      <details className="request-details"><summary>How requests are saved</summary><p className="field-hint">Repeated requests for the same inputs reuse the saved run. No automatic provider retries.</p></details>
    </details>
    {!!workspace.reviews.length && <div className="field review-history-select"><label htmlFor="review-history">Saved reviews</label><select id="review-history" value={run?.id || ""} onChange={e => { const selected = workspace.reviews.find(r => r.id === e.target.value); setRun(selected); if (selected) { setResumeId(selected.resume_id); setJobId(selected.job_id); } setConsent(false); setIncludeAnswers(false); setError(""); window.history.replaceState(null, "", `?run=${e.target.value}`); }}>{workspace.reviews.map(r => <option key={r.id} value={r.id}>{r.mode === "mock" ? "Mock" : "OpenAI"} · {r.status.replaceAll("_", " ")} · {new Date(r.created_at).toLocaleString()}</option>)}</select></div>}
    {initialRun && !workspace.reviews.some(r => r.id === initialRun) && <p className="form-error" role="alert">The requested review does not belong to this application or was not found.</p>}
    {run && <>
      {active && <p className="notice" role="status">Review in progress. You can leave this page and reopen the saved run. Do not resubmit after a timeout.</p>}
      {!active && run.status !== "succeeded" && <section className="panel detail-panel"><h2>Review {run.status.replaceAll("_", " ")}</h2><p className="form-error" role="alert">{run.error}</p>{run.validation_issues?.map(issue => <p key={issue}>{issue}</p>)}<p className="preview-note">{run.mode === "mock" ? "No AI call or charge occurred. Use the README’s synthetic text, then acknowledge a new attempt above. The failed review stays in history." : "To try again, select the documents and acknowledge the request above. An uncertain previous request may already have been charged."}</p></section>}
      {run.result && <SavedReview key={run.id} run={run} documents={workspace.documents} refresh={() => refreshRun(run.id)} onApplied={doc => setWorkspace(w => ({ ...w, documents: [doc, ...w.documents.filter(d => d.id !== doc.id)] }))} />}
      <details className="panel detail-panel"><summary>Review provenance & input references</summary><dl className="provenance"><dt>Origin</dt><dd>{run.mode === "mock" ? "Synthetic mock · no model used" : "OpenAI · model-generated, human review required"}</dd><dt>Requested / returned model</dt><dd>{run.model_requested || "Not available"} / {run.model_returned || "Not available"}</dd><dt>Prompt / schema</dt><dd>{run.prompt_version || "Unknown"} / {run.schema_version || "Unknown"}</dd><dt>Résumé / job IDs</dt><dd>{run.resume_id}<br />{run.job_id}</dd><dt>Run / provider response ID</dt><dd>{run.id}<br />{run.provider_response_id || "Not available"}</dd><dt>Created</dt><dd>{new Date(run.created_at).toLocaleString()}</dd><dt>Elapsed</dt><dd>{run.latency_ms === null ? "Unknown" : `${run.latency_ms} ms (not a benchmark)`}</dd><dt>Usage</dt><dd>{run.usage ? JSON.stringify(run.usage) : "Not available; no estimated cost substituted"}</dd></dl>{run.input_snapshot.clarifications.map(a => <p key={a.event_id} className="body-copy">User-supplied answer: {a.question} — {a.answer}</p>)}</details>
    </>}
  </>;
}

function SourceLink({ citation, documents, onSelect }: { citation: Citation; documents: DocumentVersion[]; onSelect: (citation: Citation) => void }) {
  const doc = documents.find(d => d.id === citation.document_id);
  return <button className="evidence-link" onClick={() => onSelect(citation)}><span>“{citation.quote}”</span><small>{doc?.kind === "job" ? "Job" : "Résumé"} · {doc?.label} · {citation.passage_id.split(":").at(-1)} · exact quote checked</small></button>;
}

function SavedReview({ run, documents, refresh, onApplied }: { run: ReviewRun; documents: DocumentVersion[]; refresh: () => Promise<ReviewRun>; onApplied: (doc: DocumentVersion) => void }) {
  const result = run.result!;
  const [citation, setCitation] = useState<Citation | null>(null);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const applyRequest = useRef<{ key: string; id: string } | null>(null);
  const source = documents.find(d => d.id === (citation?.document_id || run.resume_id));
  const latest = new Map<string, ReviewEvent>();
  run.events.filter(e => e.kind === "decision").forEach(e => latest.set(e.target_id, e));
  const accepted = [...latest.values()].filter(e => e.payload.decision !== "reject");
  function showSource(value: Citation) { setCitation(value); document.getElementById("saved-source")?.focus(); }
  async function apply() {
    setBusy(true); setError(""); setMessage("");
    const event_ids = accepted.map(e => e.id).sort(); const key = JSON.stringify(event_ids);
    if (applyRequest.current?.key !== key) applyRequest.current = { key, id: crypto.randomUUID() };
    try {
      const doc = await trackerApi<DocumentVersion>(`/reviews/${run.id}/apply`, { method: "POST", body: JSON.stringify({ id: applyRequest.current.id, event_ids }) });
      onApplied(doc); await refresh(); setMessage("New résumé version saved. The source version and this review are unchanged.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <>
    <section className="review-intro" id="review-result" tabIndex={-1}><p className="eyebrow">{run.mode === "mock" ? "SAVED SYNTHETIC MOCK" : "SAVED MODEL REVIEW"}</p><h2>What the text supports</h2><p>{result.summary}</p><p className="preview-note">Reviewed inputs: résumé “{documents.find(d => d.id === run.resume_id)?.label}” · job “{documents.find(d => d.id === run.job_id)?.label}”.</p><p className="preview-note">Exact quotations were checked against the selected documents. This does not prove the assessment is correct. “Not evidenced” describes this text, not your ability.</p></section>
    <nav className="review-steps" aria-label="Review steps"><a href="#review-evidence">1. Evidence</a><a href="#review-context">2. Context</a><a href="#review-wording">3. Wording</a></nav><div className="saved-review-grid"><section className="panel detail-panel"><h2 id="review-evidence">1. Check the evidence</h2>{(["required", "preferred", "unspecified"] as const).map(group => <div key={group} className="requirement-group"><h3>{group === "unspecified" ? "Priority unspecified" : group === "required" ? "Required" : "Preferred"}</h3>{!result.requirements.some(r => r.importance === group) && <p className="preview-note">None identified in this group.</p>}{result.requirements.filter(r => r.importance === group).map(r => <details key={r.id} className="saved-requirement"><summary><span>{r.text}</span><span className={`assessment-label ${r.assessment}`}>{r.assessment.replaceAll("_", " ")}</span></summary><p>{r.explanation}</p><p className="preview-note">Experience context: {r.experience_context}</p><SourceLink citation={r.job_evidence} documents={documents} onSelect={showSource} />{r.evidence.map((c, i) => <SourceLink key={i} citation={c} documents={documents} onSelect={showSource} />)}{!r.evidence.length && <p>No supporting résumé passage cited.</p>}</details>)}</div>)}</section>
      <section className="panel detail-panel source-panel" id="saved-source" tabIndex={-1} aria-label="Selected document source"><p className="eyebrow">ORIGINAL SOURCE</p><h2>{source?.kind === "job" ? "Job snapshot" : "Résumé"}</h2><p className="preview-note">{source?.label}</p>{source?.passages.map(p => <p key={p.id} className={`source-passage ${citation?.passage_id === p.id ? "highlighted" : ""}`}>{p.text}<small title={p.id}>Source {p.id.split(":").at(-1)}</small></p>)}<p className="source-note" role="status">{citation ? "Highlighted the original passage. Check context as well as the quoted words." : "Select an evidence quote to inspect its source."}</p></section></div>
    <section className="panel detail-panel"><h2 id="review-context">2. Add missing context</h2><p className="preview-note">Save what you know. Answers are user claims; saving does not change this review or run AI.</p>{!result.clarifications.length && <p>No clarification questions in this review.</p>}{result.clarifications.map(q => <AnswerForm key={q.id} run={run} question={q} refresh={refresh} />)}</section>
    <section className="panel detail-panel"><h2 id="review-wording">3. Choose your wording</h2><p className="preview-note">Check the facts, accept or edit a suggestion, then save a new résumé version. It starts from this review’s original résumé; later edits are not merged.</p>{result.revisions.map(revision => <RevisionForm key={revision.id} revision={revision} run={run} latest={latest.get(revision.id)} refresh={refresh} />)}{!result.revisions.length && <p>No wording revisions suggested.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
      <button className="button" disabled={!accepted.length || busy} onClick={apply}>{busy ? "Creating version…" : "Apply accepted revisions as new version"}</button>
      {!!run.applied_versions.length && <p className="preview-note">{run.applied_versions.length} revised {run.applied_versions.length === 1 ? "version" : "versions"} saved. <Link className="text-link" href={`/applications/${run.application_id}#documents`}>View saved versions</Link>. Applying the same decisions returns the same version.</p>}
    </section>
    <details className="panel detail-panel"><summary>Answer & decision history ({run.events.length})</summary>{run.events.map(e => <div className="history-event" key={e.id}><strong>{e.kind === "clarification" ? "User-supplied answer" : `Revision ${e.payload.decision}`}</strong><p className="body-copy">{e.payload.answer || e.payload.text || `Suggestion ${e.target_id}`}</p><small>{new Date(e.created_at).toLocaleString()} · {e.id}</small></div>)}</details>
  </>;
}

function AnswerForm({ run, question, refresh }: { run: ReviewRun; question: { id: string; question: string }; refresh: () => Promise<ReviewRun> }) {
  const saved = run.events.filter(e => e.kind === "clarification" && e.target_id === question.id).at(-1);
  const [answer, setAnswer] = useState(saved?.payload.answer || ""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const request = useRef<{ key: string; id: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    if (request.current?.key !== answer) request.current = { key: answer, id: crypto.randomUUID() };
    try {
      await trackerApi(`/reviews/${run.id}/events`, { method: "POST", body: JSON.stringify({ id: request.current.id, kind: "clarification", target_id: question.id, answer }) });
      await refresh(); setMessage("Answer saved as a user-supplied claim.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form className="clarification-form" onSubmit={submit}><div className="field"><label htmlFor={`answer-${question.id}`}>{question.question}</label><textarea id={`answer-${question.id}`} value={answer} onChange={e => { setAnswer(e.target.value); setMessage(""); }} required maxLength={4000} rows={3} /></div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}<button className="button secondary" disabled={busy}>{busy ? "Saving…" : "Save answer"}</button></form>;
}

function RevisionForm({ revision, run, latest, refresh }: { revision: Revision; run: ReviewRun; latest?: ReviewEvent; refresh: () => Promise<ReviewRun> }) {
  const [text, setText] = useState(latest?.payload.text || revision.proposed);
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const request = useRef<{ key: string; id: string } | null>(null);
  async function decide(decision: "accept" | "edit" | "reject") {
    setBusy(true); setError("");
    const fields = { kind: "decision", target_id: revision.id, decision, text: decision === "edit" ? text : null, confirmed_facts: confirmed };
    const key = JSON.stringify(fields); if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    try { await trackerApi(`/reviews/${run.id}/events`, { method: "POST", body: JSON.stringify({ ...fields, id: request.current.id }) }); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="revision-item" open><summary>Suggested wording · {latest ? latest.payload.decision : "undecided"}</summary><div className="comparison-grid"><div><small>Original · {revision.source.passage_id.split(":").at(-1)}</small>{revision.source.quote}</div><div className="suggested"><small>Proposed · needs your review</small>{revision.proposed}</div></div><p className="preview-note">{revision.rationale}</p>{!!revision.clarification_ids.length && <p className="notice">Uses user-supplied clarifications; those claims have not been independently verified.</p>}<details className="wording-editor"><summary>Edit the suggestion yourself</summary><div className="field"><label htmlFor={`revision-${revision.id}`}>Your edited wording</label><textarea id={`revision-${revision.id}`} value={text} maxLength={12000} rows={3} onChange={e => { setText(e.target.value); setConfirmed(false); }} /></div><button className="button secondary" disabled={busy || !confirmed || !text.trim()} onClick={() => decide("edit")}>Save my edited wording</button></details><label className="check-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I checked the facts and experience context. This wording does not invent claims.</label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className={latest?.payload.decision === "accept" ? "button secondary" : "button"} disabled={busy || !confirmed} onClick={() => decide("accept")}>Accept proposed wording</button><button className="text-button" disabled={busy} onClick={() => decide("reject")}>Reject suggestion</button></div>{latest && <p role="status" className="preview-note">Saved decision: {latest.payload.decision}. Previous decisions remain in history.</p>}</details>;
}
