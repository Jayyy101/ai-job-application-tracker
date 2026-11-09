import Link from "next/link";
import type { ApplicationStatus } from "@/types/application";

const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  applications: "M4 7h16v14H4z M8 7V3h8v4 M4 12h16 M10 12v3h4v-3",
  review: "M7 3h10l3 3v15H4V3h3 M8 9h8 M8 13h5 M8 17h3",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  plus: "M12 5v14 M5 12h14",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><span />{status}</span>;
}

export function PageHeading({ eyebrow, title, description, action = true }: { eyebrow: string; title: string; description: string; action?: boolean }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{description}</p></div>{action && <Link href="/applications/new" className="button"><Icon name="plus" />Add application</Link>}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: { href: string; label: string } }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="applications" /></span><h2>{title}</h2><p>{description}</p>{action && <Link className="button" href={action.href}>{action.label}</Link>}</div>;
}
