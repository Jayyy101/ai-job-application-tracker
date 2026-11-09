"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const nav = [
    { href: "/", label: "Overview", icon: "overview" as const },
    { href: "/applications", label: "Applications", icon: "applications" as const },
    { href: "/review", label: "Review demo", icon: "review" as const },
  ];
  return <div className="workspace"><a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar"><Link href="/" className="brand" aria-label="Jobfolio overview"><span className="brand-mark">j<span>.</span></span><span>jobfolio<span className="brand-caption">A clearer next step</span></span></Link>
      <p className="nav-caption">WORKSPACE</p><nav aria-label="Main navigation">{nav.map((item) => {
        const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} className={`nav-item ${current ? "active" : ""}`} aria-current={current ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span>{item.href === "/review" && <span className="nav-preview">Unsaved</span>}</Link>;
      })}</nav><div className="sidebar-bottom"><div className="workspace-dot" /><div><strong>Development workspace</strong><p>Separate local database</p></div></div>
    </aside>
    <div className="workspace-body"><header className="topbar"><span>YOUR JOB SEARCH, ORGANIZED</span><span className="demo-indicator">Development preview</span></header><main id="main-content" tabIndex={-1} className="page-content">{children}</main><footer className="workspace-footer"><span>Built for thoughtful progress.</span><Link href="/baseline">Original analysis baseline</Link></footer></div>
  </div>;
}
