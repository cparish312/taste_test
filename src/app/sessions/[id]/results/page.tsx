import { notFound, redirect } from "next/navigation";
import { ResultView } from "@/components/ResultView";
import { LoadingState } from "@/components/LoadingState";
import { buildSessionState } from "@/lib/sessionService";
import type { FinalAnswer } from "@/lib/tasteTestSchemas";

type ResultsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;
  const state = await buildSessionState(id);

  if (!state) {
    notFound();
  }

  if (state.status === "active") {
    redirect(`/sessions/${id}`);
  }

  if (state.status === "finalizing") {
    return (
      <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-violet-50 via-white to-white px-4 py-16">
        <LoadingState
          message="Getting your answer…"
          submessage="This usually takes a few seconds"
        />
      </div>
    );
  }

  if (!state.finalData) {
    notFound();
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50 via-white to-white px-4 py-16">
      <ResultView
        userPrompt={state.userPrompt}
        finalData={state.finalData as FinalAnswer}
      />
    </div>
  );
}
