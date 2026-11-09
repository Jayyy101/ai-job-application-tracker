import Link from "next/link";
import type { Application } from "@/types/application";
import { dueLabel, localDay } from "@/lib/applications";
import { Icon, StatusBadge } from "./ui";

export function ApplicationTable({ applications }: { applications: Application[] }) {
  return <div className="table-scroll"><table className="application-table"><caption className="sr-only">Saved applications</caption><thead><tr><th scope="col">Role & company</th><th scope="col">Status</th><th scope="col">Next step</th><th scope="col">Follow-up</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead><tbody>{applications.map((item) => <tr key={item.id}><td><div className="role-cell"><span className="company-avatar" aria-hidden="true">{item.company.slice(0, 1).toUpperCase()}</span><div><Link href={`/applications/${item.id}`} className="role-link">{item.role}</Link><span className="company-name">{item.company}{item.archived_at && " · Archived"}</span></div></div></td><td><StatusBadge status={item.status} /></td><td className="next-step-cell">{item.next_action || <span className="muted">No next step set</span>}</td><td><span className={item.follow_up_date && item.follow_up_date <= localDay() && !["Rejected", "Withdrawn"].includes(item.status) && !item.archived_at ? "due-text" : "muted"}>{dueLabel(item.follow_up_date) || "—"}</span></td><td><Link href={`/applications/${item.id}`} className="icon-link" aria-label={`Open ${item.role} at ${item.company}`}><Icon name="arrow" /></Link></td></tr>)}</tbody></table></div>;
}
