import type { Application } from "@/types/application";

// An explicit field allowlist prevents documents, review payloads or secrets from
// being included if the API response gains additional properties later.
const COLUMNS: [keyof Application, string][] = [
  ["id", "Application ID"], ["company", "Company"], ["role", "Role"], ["status", "Status"],
  ["job_link", "Posting URL"], ["job_description", "Posting draft"], ["notes", "Notes"],
  ["next_action", "Next action"], ["follow_up_date", "Follow-up date"],
  ["archived_at", "Archived at (UTC)"], ["created_at", "Created at (UTC)"], ["updated_at", "Updated at (UTC)"],
];

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // Quote escaping handles separators/newlines. Apostrophe-prefix dangerous
  // spreadsheet cells, including whitespace/invisible prefixes and locale variants.
  const normalizedStart = text.replace(/^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]+/u, "");
  if (/^[=+\-@＝＋－＠]/u.test(normalizedStart) || /^[\t\r\n\u0000]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function applicationsCsv(applications: Application[]): string {
  const rows = [COLUMNS.map(([, label]) => csvCell(label)).join(","),
    ...applications.map(app => COLUMNS.map(([key]) => csvCell(app[key])).join(","))];
  return "\ufeff" + rows.join("\r\n") + "\r\n";
}

export function resumeFilename(label: string, id: string): string {
  const safe = label.normalize("NFC").replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/gu, "-").slice(0, 60) || "version";
  return `jobfolio-resume-${safe}-${id.slice(0, 8)}.txt`;
}

export function downloadText(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  // Revoking synchronously can cancel downloads in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
