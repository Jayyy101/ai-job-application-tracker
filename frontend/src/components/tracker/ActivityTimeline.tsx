"use client";
import Link from "next/link";
import { useState } from "react";
import { RemoteState, useRemote } from "./remote";

type Activity = { events: { id: string; at: string; title: string; detail: string; href: string | null }[]; history_note: string };

export function ActivityTimeline({ applicationId }: { applicationId: string }) {
  const { data, loading, error, reload } = useRemote<Activity>(`/applications/${applicationId}/activity`);
  const [expanded, setExpanded] = useState(false);
  function openVersion(href: string) {
    const version = document.getElementById(href.slice(1));
    if (!version) return;
    let parent: HTMLElement | null = version;
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    version.querySelector("summary")?.focus();
    version.scrollIntoView({ block: "center", behavior: "instant" });
  }
  return <section className="panel detail-panel activity-panel" aria-labelledby="activity-title"><div className="section-heading"><h2 id="activity-title">Activity</h2><button className="text-button" onClick={reload}>Refresh activity</button></div>
    <p className="preview-note">Newest first.</p>{data?.history_note && <details className="history-note"><summary>About earlier history</summary><p className="preview-note">{data.history_note}</p></details>}
    <RemoteState loading={loading} error={error} retry={reload} />
    {data && <><ol className="activity-timeline">{(expanded ? data.events : data.events.slice(0, 8)).map(event => <li key={event.id}><div className="activity-description"><strong>{event.href ? event.href.startsWith("#") ? <button className="text-link" onClick={() => openVersion(event.href!)}>{event.title}</button> : <Link className="text-link" href={event.href}>{event.title}</Link> : event.title}</strong>{event.detail && <p>{event.detail}</p>}</div><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></li>)}</ol>{data.events.length > 8 && <button className="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Show recent activity" : `Show all ${data.events.length} events`}</button>}</>}
  </section>;
}
