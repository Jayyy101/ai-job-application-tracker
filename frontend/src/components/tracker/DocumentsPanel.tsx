"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { downloadText, resumeFilename } from "@/lib/exports";
import { trackerApi } from "@/lib/tracker-api";
import type { DocumentVersion, Workspace } from "@/types/review";
import { RemoteState, useRemote } from "./remote";

export function DocumentsPanel({ applicationId, jobDraft, onChanged }: { applicationId: string; jobDraft: string | null; onChanged: () => void }) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const { data, loading, error, reload } = useRemote<Workspace>(`/applications/${applicationId}/workspace`);
  useEffect(() => {
    if (!savedId || !data?.documents.some(doc => doc.id === savedId)) return;
    const version = document.getElementById(`version-${savedId}`);
    if (version?.parentElement instanceof HTMLDetailsElement) version.parentElement.open = true;
    version?.querySelector("summary")?.focus();
  }, [data, savedId]);
  return <section className="panel detail-panel documents-panel" id="documents"><div className="section-heading"><div><p className="eyebrow">DOCUMENTS & HISTORY</p><h2>Prepare a review</h2></div>{data?.documents.some(d => d.kind === "resume") && data.documents.some(d => d.kind === "job") && <Link className="button" href={`/applications/${applicationId}/review`}>Open review workspace</Link>}</div>
    <p className="preview-note">{!data?.documents.some(d => d.kind === "resume") ? "Next: add your résumé text below." : !data.documents.some(d => d.kind === "job") ? "Next: add the job description." : "Both documents are saved. Open the review workspace when you’re ready."}</p>
    {savedId && <p className="notice" role="status">Version saved. The original text remains unchanged.</p>}
    <RemoteState loading={loading} error={error} retry={reload} />
    {data && <DocumentManager applicationId={applicationId} workspace={data} jobDraft={jobDraft} reload={reload} onSaved={id => { setSavedId(id); onChanged(); }} />}
  </section>;
}

function DocumentManager({ applicationId, workspace, jobDraft, reload, onSaved }: { applicationId: string; workspace: Workspace; jobDraft: string | null; reload: () => void; onSaved: (id: string) => void }) {
  const [kind, setKind] = useState<"resume" | "job">("resume");
  const [label, setLabel] = useState(""); const [text, setText] = useState("");
  const [parent, setParent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const request = useRef<{ content: string; id: string } | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const fields = { kind, label, text, parent_id: parent }; const content = JSON.stringify(fields);
    if (request.current?.content !== content) request.current = { content, id: crypto.randomUUID() };
    try {
      const saved = await trackerApi<DocumentVersion>(`/applications/${applicationId}/documents`, { method: "POST", body: JSON.stringify({ ...fields, id: request.current.id }) });
      setMessage("Version saved. The original text remains unchanged."); setText(""); setLabel(""); setParent(null); request.current = null; onSaved(saved.id); reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function revise(doc: DocumentVersion) {
    setKind(doc.kind); setLabel(`${doc.label} · revision`.slice(0, 120)); setText(doc.text); setParent(doc.id); setMessage("");
    document.getElementById("document-editor")?.setAttribute("open", "");
    requestAnimationFrame(() => document.getElementById("document-text")?.focus());
  }
  return <>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="document-summary">{(["resume", "job"] as const).map(k => <div key={k}><strong>{k === "resume" ? "Résumé" : "Job description"}</strong><span>{workspace.documents.filter(d => d.kind === k).length} saved {workspace.documents.filter(d => d.kind === k).length === 1 ? "version" : "versions"}</span></div>)}</div>
    <details id="document-editor" className="document-editor"><summary>Add or revise pasted text</summary>
      <form onSubmit={save} className="document-form">
        {error && <p className="form-error" role="alert">{error} Your text is kept here.</p>}
        {parent && <p className="notice">Creating a new version from a saved document. <button type="button" className="text-button" onClick={() => setParent(null)}>Start independently instead</button></p>}
        <div className="field"><label htmlFor="document-kind">Document</label><select id="document-kind" value={kind} disabled={busy || !!parent} onChange={e => setKind(e.target.value as "resume" | "job")}><option value="resume">Résumé</option><option value="job">Job description</option></select></div>
        <div className="field"><label htmlFor="document-label">Version name <small>Required</small></label><input id="document-label" required maxLength={120} value={label} disabled={busy} onChange={e => setLabel(e.target.value)} placeholder="For example: Frontend focus" /></div>
        {kind === "job" && jobDraft && <button type="button" className="text-button" onClick={() => { setText(jobDraft); setLabel(label || "Saved application posting"); }}>Copy the application’s saved posting</button>}
        <div className="field"><label htmlFor="document-text">Pasted text <small>Required</small></label><textarea id="document-text" required rows={9} maxLength={30000} value={text} disabled={busy} onChange={e => setText(e.target.value)} aria-describedby="document-help" /><p id="document-help" className="field-hint">Keep headings and bullets on separate lines. Saving does not call AI.</p></div>
        <button className="button" disabled={busy}>{busy ? "Saving…" : "Save document version"}</button>
      </form>
    </details>
    <details className="version-history"><summary>Saved versions ({workspace.documents.length})</summary>{!workspace.documents.length && <p className="preview-note">Add a résumé and job description above to begin.</p>}{workspace.documents.map(doc => <details key={doc.id} className="version-item" id={`version-${doc.id}`}><summary>{doc.kind === "resume" ? "Résumé" : "Job"} · {doc.label} · {new Date(doc.created_at).toLocaleString()}</summary><details className="version-metadata"><summary>Version references</summary><p className="source-reference">{doc.id} · {doc.origin}{doc.parent_id && ` · based on ${doc.parent_id}`}</p></details><p className="body-copy">{doc.text}</p><div className="form-actions"><button className="button secondary" onClick={() => revise(doc)}>Revise this version</button>{doc.kind === "resume" && <button className="button secondary" onClick={() => { downloadText(doc.text, resumeFilename(doc.label, doc.id), "text/plain;charset=utf-8"); setMessage(`Download requested for résumé version “${doc.label}”. Exact saved text only.`); }}>Download résumé text</button>}</div></details>)}</details>
    <details className="version-history"><summary>Previous reviews ({workspace.reviews.length})</summary>{!workspace.reviews.length && <p className="preview-note">No saved reviews yet. Save both documents, then open the review workspace.</p>}{workspace.reviews.map(run => <Link className="history-link" key={run.id} href={`/applications/${applicationId}/review?run=${run.id}`}><span>{run.mode === "mock" ? "Mock review" : "OpenAI review"} · {run.status.replaceAll("_", " ")}</span><small>{new Date(run.created_at).toLocaleString()}</small></Link>)}</details>
    {workspace.legacy.map(item => <details className="version-history" key={item.legacy_id}><summary>Imported legacy analysis #{item.legacy_id} · provenance unknown</summary><p className="preview-note">Legacy score: {String(item.raw_record.match_score ?? "unknown")}. Uncalibrated historical output, not an ATS score or hiring probability. Original content is preserved below; it has no verified citations.</p><pre className="legacy-record">{JSON.stringify(item.raw_record, null, 2)}</pre></details>)}
  </>;
}
