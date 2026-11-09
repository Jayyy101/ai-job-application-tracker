import { ApplicationDetails } from "@/components/tracker/ApplicationDetails";

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  return <ApplicationDetails id={id} justSaved={saved === "1"} />;
}
