import { ReviewWorkspace } from "@/components/tracker/ReviewWorkspace";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const { id } = await params; const { run } = await searchParams;
  return <ReviewWorkspace applicationId={id} initialRun={run} />;
}
