"use client";

import { applicationsCsv, downloadText } from "@/lib/exports";
import { localDay } from "@/lib/applications";
import { useState } from "react";
import { STATUSES, type Application } from "@/types/application";
import { ApplicationTable } from "./ApplicationTable";
import { EmptyState, PageHeading } from "./ui";
import { RemoteState, useRemote } from "./remote";

export function ApplicationsList() {
  const { data, loading, error, reload } = useRemote<Application[]>("/applications");
  const [exportScope, setExportScope] = useState("view");
  const [exportMessage, setExportMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [scope, setScope] = useState("current");
  const [sort, setSort] = useState("updated");
  const scoped = (data ?? []).filter((item) => scope === "archived" ? !!item.archived_at : !item.archived_at);
  const matches = scoped.filter((item) => (status === "All" || item.status === status) && [item.company, item.role, item.notes, item.next_action].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => {
    if (sort === "company") return a.company.localeCompare(b.company) || a.role.localeCompare(b.role);
    if (sort === "follow_up") return (a.follow_up_date ?? "9999").localeCompare(b.follow_up_date ?? "9999");
    return b.updated_at.localeCompare(a.updated_at);
  });
  const filtered = !!search || status !== "All" || sort !== "updated";
  function reset() { setSearch(""); setStatus("All"); setSort("updated"); }
  return <><PageHeading eyebrow="ONE PLACE FOR EVERY OPPORTUNITY" title="Applications" description="Track the role, keep your notes, and decide on the next step." /><RemoteState loading={loading} error={error} retry={reload} />
    {data && <section className="panel"><div className="list-scope" role="group" aria-label="Application visibility"><button aria-pressed={scope === "current"} className={scope === "current" ? "selected" : ""} onClick={() => setScope("current")}>Current <span>{data.filter((item) => !item.archived_at).length}</span></button><button aria-pressed={scope === "archived"} className={scope === "archived" ? "selected" : ""} onClick={() => setScope("archived")}>Archived <span>{data.filter((item) => item.archived_at).length}</span></button></div>
    <div className="list-filters"><div className="field search-field"><label htmlFor="search-applications">Search applications</label><input id="search-applications" type="search" placeholder="Company, role, or notes…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="field"><label htmlFor="filter-status">Status</label><select id="filter-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="All">All statuses</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="sort-applications">Sort by</label><select id="sort-applications" value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="follow_up">Follow-up date</option><option value="company">Company A–Z</option></select></div></div>
    <div className="results-summary"><p role="status">Showing {matches.length} of {scoped.length} {scope === "archived" ? "archived " : ""}{scoped.length === 1 ? "application" : "applications"}</p>{filtered && <button className="text-button" onClick={reset}>Clear filters</button>}</div>
    <div className="export-bar"><div className="field"><label htmlFor="export-scope">CSV export scope</label><select id="export-scope" value={exportScope} onChange={e => { setExportScope(e.target.value); setExportMessage(""); }}><option value="view">Filtered {scope} view · {matches.length} {matches.length === 1 ? "record" : "records"}</option><option value="all">All applications, including archived · {data.length} {data.length === 1 ? "record" : "records"}</option></select></div><button className="button secondary" onClick={() => {
      const rows = exportScope === "view" ? matches : data;
      downloadText(applicationsCsv(rows), `jobfolio-applications-${exportScope === "view" ? `${scope}-filtered` : "all-including-archived"}-${localDay()}.csv`, "text/csv;charset=utf-8");
      setExportMessage(`Download requested: ${rows.length} ${exportScope === "view" ? `${scope} ${rows.length === 1 ? "application" : "applications"} matching the current filters and sort` : `${rows.length === 1 ? "application" : "applications"}, including archived; filters ignored`}.`);
    }}>Export applications CSV</button><p className="field-hint">{exportScope === "view" ? `Includes only this ${scope} view, with the current search, status filter, and sort.` : "Includes current and archived records. Search, status filters, and displayed sort are ignored."} Tracking fields only.</p><details className="export-details"><summary>CSV format details</summary><p className="field-hint">No résumés or AI payloads. Unicode and multiline text are preserved. Formula-like cells receive a protective apostrophe for spreadsheet safety.</p></details>{exportMessage && <p role="status">{exportMessage}</p>}</div>
    {matches.length ? <ApplicationTable applications={matches} /> : <EmptyState title={scoped.length ? "No applications match these filters" : scope === "archived" ? "Nothing archived yet" : "Make room for your next opportunity"} description={scoped.length ? "Try a different search or clear your filters." : scope === "archived" ? "Archived applications stay available here. You can restore them at any time." : "Start with a company and role. Everything else can come later."} action={!scoped.length && scope === "current" ? { href: "/applications/new", label: "Add application" } : undefined} />}
    </section>}
  </>;
}
