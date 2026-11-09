"use client";

import Link from "next/link";
import type { Application } from "@/types/application";
import { dueLabel, localDay, needsFollowUp, openApplications } from "@/lib/applications";
import { useRemote, RemoteState } from "./remote";
import { EmptyState, Icon, PageHeading } from "./ui";
import { ApplicationTable } from "./ApplicationTable";

export function Dashboard() {
  const { data, loading, error, reload } = useRemote<Application[]>("/applications");
  const applications = openApplications(data ?? []);
  const today = localDay();
  const week = new Date(); week.setDate(week.getDate() + 7);
  const followUps = applications.filter(needsFollowUp).filter((item) => item.follow_up_date! <= localDay(week)).sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!));
  const active = applications.filter((item) => ["Applied", "Interviewing", "Offer"].includes(item.status)).length;
  return <><PageHeading eyebrow="A LITTLE CLARITY, EVERY DAY" title="Your next steps" description="A focused view of your applications and what comes next." /><RemoteState loading={loading} error={error} retry={reload} />
    {data && <><div className="stats-grid"><div className="stat-card"><span>Saved applications</span><strong>{applications.length}</strong><p>All unarchived applications</p></div><div className="stat-card"><span>In progress</span><strong>{active}<span className="stat-dot" /></strong><p>Applied, interviewing, or offer</p></div><div className="stat-card"><span>Follow-ups to make</span><strong>{followUps.length}</strong><p>Overdue, today, and the next 7 days</p></div></div>
    {applications.length === 0 ? <section className="panel"><EmptyState title="Your next opportunity starts here" description="Save a company and role. Add the rest when you’re ready—no résumé or AI analysis needed." action={{ href: "/applications/new", label: "Save your first application" }} /></section> : <>
      <div className="dashboard-grid"><section className="panel follow-up-panel"><div className="section-heading"><div><span className="eyebrow">FOCUS FOR THE WEEK</span><h2>Coming up <span className="count-chip">{followUps.length}</span></h2></div><Icon name="clock" /></div>{followUps.length ? <div className="follow-up-list">{followUps.slice(0, 4).map((item) => <Link href={`/applications/${item.id}`} key={item.id} className="follow-up-row"><span className={`follow-up-dot ${item.follow_up_date! < today ? "overdue" : ""}`} /><div><strong>{item.next_action || `Follow up with ${item.company}`}</strong><p>{item.company} <span>·</span> {item.role}</p></div><span className={item.follow_up_date! <= today ? "due-label" : "date-label"}>{dueLabel(item.follow_up_date)}</span></Link>)}</div> : <p className="quiet-empty">You’re caught up. Add a follow-up date to an application when you have a next step.</p>}{followUps.length > 4 && <p className="preview-note">Showing 4 of {followUps.length} follow-ups. <Link href="/applications" className="text-link">View applications <Icon name="arrow" /></Link></p>}</section>
      <aside className="coaching-card"><span className="preview-label">SEPARATE DEMO</span><span className="coaching-icon"><Icon name="review" /></span><h2>Let your experience<br />speak for itself.</h2><p>Try a hand-authored example. Your saved reviews live with each application.</p><Link href="/review" className="button secondary">Explore the demo <Icon name="arrow" /></Link><small>Synthetic example · No AI calls</small></aside></div>
      <section className="panel"><div className="section-heading"><div><span className="eyebrow">KEEP YOUR PLACE</span><h2>Recent applications</h2></div><Link href="/applications" className="text-link">View all <Icon name="arrow" /></Link></div><ApplicationTable applications={applications.slice(0, 5)} /></section></>}
    </>}
  </>;
}
