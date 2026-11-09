"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Application, ApplicationFields } from "@/types/application";
import { trackerApi } from "@/lib/tracker-api";
import { ApplicationForm } from "./ApplicationForm";
import { Icon, PageHeading } from "./ui";

export function NewApplication() {
  const router = useRouter();
  async function save(fields: ApplicationFields, id: string) {
    const item = await trackerApi<Application>("/applications", { method: "POST", body: JSON.stringify({ ...fields, id }) });
    router.push(`/applications/${item.id}?saved=1`);
  }
  return <><Link href="/applications" className="back-link"><Icon name="arrow" />Applications</Link><PageHeading eyebrow="SAVE AN OPPORTUNITY" title="Add an application" description="Start with the basics. Keep the next step in sight." action={false} /><div className="form-layout"><ApplicationForm onSave={save} onCancel={() => router.push("/applications")} /><aside className="panel form-aside"><h2>Start with company and role.</h2><p>Add a follow-up or résumé when you’re ready. Saving never runs AI.</p><small>Separate development workspace · use synthetic information.</small></aside></div></>;
}
