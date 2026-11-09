import { WorkspaceShell } from "@/components/tracker/WorkspaceShell";

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
