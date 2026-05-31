import { notFound, redirect } from "next/navigation";
import { SessionClient } from "@/components/SessionClient";
import { buildSessionState } from "@/lib/sessionService";

type SessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const state = await buildSessionState(id);

  if (!state) {
    notFound();
  }

  if (state.status === "complete" && state.finalData) {
    redirect(`/sessions/${id}/results`);
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50 via-white to-white">
      <SessionClient sessionId={id} initialState={state} />
    </div>
  );
}
