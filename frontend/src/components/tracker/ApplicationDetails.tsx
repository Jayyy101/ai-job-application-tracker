"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Application, ApplicationFields } from "@/types/application";
import { trackerApi } from "@/lib/tracker-api";
import { formatDay } from "@/lib/applications";
import { ActivityTimeline } from "./ActivityTimeline";
import { DocumentsPanel } from "./DocumentsPanel";
import { ApplicationForm } from "./ApplicationForm";
import { RemoteState, useRemote } from "./remote";
import { Icon, StatusBadge } from "./ui";

function Details({ initial, justSaved }: { initial: Application; justSaved: boolean }) {
  const changeRequest = useRef<{ key: string; id: string } | null>(null);
  function retryHeaders(key: string) {
    if (changeRequest.current?.key !== key) changeRequest.current = { key, id: crypto.randomUUID() };
    return { "X-Request-ID": changeRequest.current.id };
  }
  const [activityRevision, setActivityRevision] = useState(0);
  const [item, setItem] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(justSaved ? "Application saved. Add a next step whenever you’re ready." : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  async function save(fields: ApplicationFields) {
    const updated = await trackerApi<Application>(`/applications/${item.id}`, { method: "PUT", headers: retryHeaders(JSON.stringify(fields)), body: JSON.stringify(fields) });
    changeRequest.current = null; setItem(updated); setEditing(false); setMessage("Changes saved."); setError("");
    requestAnimationFrame(() => editButton.current?.focus());
  }
  async function archiveOrRestore() {
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await trackerApi<Application>(`/applications/${item.id}/${item.archived_at ? "restore" : "archive"}`, { method: "POST", headers: retryHeaders(item.archived_at ? "restore" : "archive") });
      changeRequest.current = null; setItem(updated); setMessage(updated.archived_at ? "Application archived. You can restore it at any time." : "Application restored to your current list.");
      dialog.current?.close(); requestAnimationFrame(() => heading.current?.focus());
    } catch (failure) { setError((failure as Error).message); dialog.current?.close(); }
    finally { setBusy(false); }
  }
  const editable: ApplicationFields = { company: item.company, role: item.role, status: item.status, job_link: item.job_link, job_description: item.job_description, notes: item.notes, next_action: item.next_action, follow_up_date: item.follow_up_date };
  return <><Link href="/applications" className="back-link"><Icon name="arrow" />Applications</Link>
    {message && <div className="notice" role="status">{message}</div>}{error && <div className="form-error" role="alert">{error}</div>}
    <div className="detail-header"><div><p className="eyebrow">{item.archived_at ? "ARCHIVED APPLICATION" : "APPLICATION DETAILS"}</p><h1 ref={heading} tabIndex={-1}>{item.role}</h1><p className="company-title">{item.company}</p><StatusBadge status={item.status} /></div><div className="detail-actions">{!editing && <button className="button" ref={editButton} onClick={() => { setEditing(true); setMessage(""); setError(""); requestAnimationFrame(() => document.getElementById("application-company")?.focus()); }} disabled={busy}>Edit details</button>}<button className="button subtle" disabled={busy || editing} onClick={() => item.archived_at ? archiveOrRestore() : dialog.current?.showModal()}>{busy ? "Saving…" : item.archived_at ? "Restore application" : "Archive"}</button></div></div>
    {editing ? <div className="form-layout"><ApplicationForm initial={editable} editing onSave={save} onCancel={() => { setEditing(false); requestAnimationFrame(() => editButton.current?.focus()); }} /><aside className="panel form-aside"><h2>Keep the same application.</h2><p>Editing updates this record. It does not create another application or run an analysis.</p></aside></div> : <div className="detail-grid"><div><section className="panel detail-panel"><h2>Next step</h2><dl><div><dt>Action</dt><dd>{item.next_action || "No next step set. Add one in Edit details."}</dd></div><div><dt>Follow-up</dt><dd>{formatDay(item.follow_up_date)}</dd></div></dl></section><section className="panel detail-panel"><h2>Notes</h2><p className="body-copy">{item.notes || "No notes yet. Keep useful context here as you learn more about the role."}</p></section><section className="panel detail-panel"><details><summary>Posting draft {item.job_description ? "· Editable tracking copy" : "· Not added"}</summary><p className="body-copy">{item.job_description || "You can add the posting later in Edit details."}</p></details></section></div><aside><section className="panel detail-panel"><h2>At a glance</h2><dl><div><dt>Job posting</dt><dd>{item.job_link ? <a className="text-link" href={item.job_link} target="_blank" rel="noopener noreferrer">Open posting ↗<span className="sr-only"> (opens in a new tab)</span></a> : "No link added"}</dd></div><div><dt>Saved</dt><dd>{new Date(item.created_at).toLocaleString()}</dd></div><div><dt>Last updated</dt><dd>{new Date(item.updated_at).toLocaleString()}</dd></div></dl></section><section className="coaching-card"><span className="preview-label">RÉSUMÉ COACHING</span><h2>Work from your evidence.</h2><p>Save your résumé and job description below, then review the evidence.</p><a className="text-link" href="#documents">Go to documents <Icon name="arrow" /></a></section></aside></div>}
    {!editing && <DocumentsPanel applicationId={item.id} jobDraft={item.job_description} onChanged={() => setActivityRevision(n => n + 1)} />}
    {!editing && <ActivityTimeline key={`${item.updated_at}:${activityRevision}`} applicationId={item.id} />}
    <dialog ref={dialog} className="archive-dialog" aria-labelledby="archive-title" aria-describedby="archive-description"><h2 id="archive-title">Archive this application?</h2><p id="archive-description">It will move out of your current list and dashboard counts. Your details stay saved, and you can restore it later.</p><div className="form-actions"><button className="button secondary" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button className="button" disabled={busy} onClick={archiveOrRestore}>{busy ? "Archiving…" : "Archive application"}</button></div></dialog>
  </>;
}

export function ApplicationDetails({ id, justSaved }: { id: string; justSaved: boolean }) {
  const { data, loading, error, reload } = useRemote<Application>(`/applications/${id}`);
  return <><RemoteState loading={loading} error={error} retry={reload} />{error && <Link href="/applications" className="text-link">Back to applications</Link>}{data && <Details key={data.id} initial={data} justSaved={justSaved} />}</>;
}
