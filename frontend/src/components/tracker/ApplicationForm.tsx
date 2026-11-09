"use client";

import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/tracker-api";
import { STATUSES, type ApplicationFields } from "@/types/application";

const EMPTY: ApplicationFields = { company: "", role: "", status: "Interested", job_link: null, job_description: null, notes: null, next_action: null, follow_up_date: null };

export function ApplicationForm({ initial = EMPTY, onSave, onCancel, editing = false }: {
  initial?: ApplicationFields;
  onSave: (fields: ApplicationFields, requestId: string) => Promise<void>;
  onCancel: () => void;
  editing?: boolean;
}) {
  const [values, setValues] = useState<ApplicationFields>(() => ({ ...initial }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const requestId = useRef<string | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);

  function update<K extends keyof ApplicationFields>(field: K, value: ApplicationFields[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function focusField(field?: string) {
    const input = field ? document.getElementById(`application-${field}`) : null;
    let parent = input?.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    (input || errorSummary.current)?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const errors: Record<string, string> = {};
    if (!values.company.trim()) errors.company = "Enter a company name.";
    if (!values.role.trim()) errors.role = "Enter a role or job title.";
    if (values.job_link) {
      try {
        const url = new URL(values.job_link);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /\s|\\/.test(values.job_link)) throw new Error();
      } catch { errors.job_link = "Use a full http:// or https:// link without credentials."; }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Check the highlighted fields. Your inputs have been kept.");
      requestAnimationFrame(() => focusField(Object.keys(errors)[0]));
      return;
    }
    setSaving(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      await onSave({ ...values, company: values.company.trim(), role: values.role.trim(), follow_up_date: values.follow_up_date || null }, requestId.current);
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError("The application could not be saved. Your inputs are still here; try again.");
      setError(apiError.message);
      setFieldErrors(apiError.fields);
      requestAnimationFrame(() => focusField(Object.keys(apiError.fields)[0]));
    } finally { setSaving(false); }
  }

  function fieldProps(field: keyof ApplicationFields) {
    return { id: `application-${field}`, name: field, "aria-invalid": !!fieldErrors[field], "aria-describedby": fieldErrors[field] ? `${field}-error` : undefined };
  }
  function errorFor(field: keyof ApplicationFields) {
    return fieldErrors[field] ? <span className="field-error" id={`${field}-error`}>{fieldErrors[field]}</span> : null;
  }

  return <form className="panel application-form" onSubmit={submit} noValidate aria-busy={saving}>
    {error && <div className="form-error" role="alert" tabIndex={-1} ref={errorSummary}>{error}</div>}
    <fieldset disabled={saving}><legend className="sr-only">Application details</legend>
      <h2 className="form-section-title">The essentials</h2><p className="form-section-copy">Only company and role are required. You can add the rest later.</p>
      <div className="form-grid"><div className="field"><label htmlFor="application-company">Company <small>Required</small></label><input {...fieldProps("company")} required maxLength={160} value={values.company} onChange={(e) => update("company", e.target.value)} placeholder="e.g. Northstar Labs" autoComplete="organization" />{errorFor("company")}</div>
      <div className="field"><label htmlFor="application-role">Role <small>Required</small></label><input {...fieldProps("role")} required maxLength={200} value={values.role} onChange={(e) => update("role", e.target.value)} placeholder="e.g. Junior Software Engineer" />{errorFor("role")}</div></div>
      <details className="tracking-options" open={editing}><summary>Tracking details <span className="preview-note">(optional)</span></summary>
      <div className="form-grid"><div className="field"><label htmlFor="application-status">Status</label><select {...fieldProps("status")} value={values.status} onChange={(e) => update("status", e.target.value as ApplicationFields["status"])}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>{errorFor("status")}</div>
      <div className="field"><label htmlFor="application-follow_up_date">Follow-up date</label><input {...fieldProps("follow_up_date")} type="date" value={values.follow_up_date ?? ""} onChange={(e) => update("follow_up_date", e.target.value || null)} />{errorFor("follow_up_date")}</div>
      <div className="field span-full"><label htmlFor="application-next_action">Next step</label><input {...fieldProps("next_action")} maxLength={240} value={values.next_action ?? ""} onChange={(e) => update("next_action", e.target.value)} placeholder="e.g. Prepare a project walkthrough" />{errorFor("next_action")}</div>
      <div className="field span-full"><label htmlFor="application-job_link">Job posting link</label><input {...fieldProps("job_link")} type="url" maxLength={2048} value={values.job_link ?? ""} onChange={(e) => update("job_link", e.target.value)} placeholder="https://example.com/careers/role" />{errorFor("job_link")}</div>
      <div className="field span-full"><label htmlFor="application-notes">Notes</label><textarea {...fieldProps("notes")} rows={4} maxLength={10000} value={values.notes ?? ""} onChange={(e) => update("notes", e.target.value)} placeholder="A contact, something you like about the team, or a reminder for later…" />{errorFor("notes")}</div>
      <div className="field span-full"><label htmlFor="application-job_description">Job description</label><textarea {...fieldProps("job_description")} rows={5} maxLength={30000} value={values.job_description ?? ""} onChange={(e) => update("job_description", e.target.value)} placeholder="Paste the posting here if you’d like to keep a copy." />{errorFor("job_description")}<p className="field-hint">Saved locally in this development workspace. No analysis is run.</p></div></div></details>
      <div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button" type="submit">{saving ? "Saving…" : editing ? "Save changes" : "Save application"}</button></div>
    </fieldset>
  </form>;
}
