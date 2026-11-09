import type { Application } from "@/types/application";

export function localDay(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function formatDay(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No date set";
}

export function dueLabel(value: string | null, today = localDay()) {
  if (!value) return null;
  if (value < today) return "Overdue";
  if (value === today) return "Today";
  return formatDay(value);
}

export function openApplications(applications: Application[]) {
  return applications.filter((item) => !item.archived_at);
}

export function needsFollowUp(item: Application) {
  return !item.archived_at && !["Rejected", "Withdrawn"].includes(item.status) && !!item.follow_up_date;
}
