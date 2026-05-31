"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/LoadingState";
import { PredictionFeedback } from "@/components/PredictionFeedback";
import { ProgressHeader } from "@/components/ProgressHeader";
import { ResponseButtons } from "@/components/ResponseButtons";
import { SwipeCard } from "@/components/SwipeCard";
import { MIN_ANSWERED_FOR_PREDICTION } from "@/lib/tasteTestSchemas";
import type { SaveResponseResult } from "@/lib/sessionService";
import type { ResponseValue, SessionItem, SessionState } from "@/lib/tasteTestSchemas";

type SessionClientProps = {
  sessionId: string;
  initialState: SessionState;
};

type ActiveFeedback = {
  predicted: ResponseValue;
  actual: ResponseValue;
  correct: boolean;
};

export function SessionClient({ sessionId, initialState }: SessionClientProps) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>(initialState);
  const [displayItem, setDisplayItem] = useState<SessionItem | null>(
    initialState.currentItem,
  );
  const [feedback, setFeedback] = useState<ActiveFeedback | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardShownAt = useRef<number>(Date.now());
  const inFlightItemId = useRef<string | null>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSession = useCallback(async () => {
    const response = await fetch(`/api/sessions/${sessionId}`);
    if (!response.ok) return;
    const data = (await response.json()) as SessionState;
    if (!feedback) {
      setState(data);
    }
  }, [sessionId, feedback]);

  useEffect(() => {
    if (state.status === "complete") {
      router.push(`/sessions/${sessionId}/results`);
    }
  }, [state.status, sessionId, router]);

  useEffect(() => {
    if (!feedback) {
      setDisplayItem(state.currentItem);
      cardShownAt.current = Date.now();
    }
  }, [state.currentItem, feedback]);

  useEffect(() => {
    const item = state.currentItem;
    if (!item || state.answeredCount < MIN_ANSWERED_FOR_PREDICTION) {
      return;
    }

    void fetch(`/api/sessions/${sessionId}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    }).catch((err) => {
      console.error("Prediction prefetch failed:", err);
    });
  }, [sessionId, state.currentItem?.id, state.answeredCount]);

  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) {
        clearTimeout(feedbackTimeout.current);
      }
    };
  }, []);

  const waitingForCards =
    !displayItem &&
    state.status === "active" &&
    !state.failedBatch &&
    (state.isGenerating || state.answeredCount > 0);

  useEffect(() => {
    if (!state.isGenerating && !waitingForCards && !state.failedBatch) {
      return;
    }

    const interval = setInterval(() => {
      void refreshSession();
    }, state.currentItem ? 2500 : 1000);

    return () => clearInterval(interval);
  }, [
    state.isGenerating,
    state.currentItem,
    state.failedBatch,
    waitingForCards,
    refreshSession,
  ]);

  const handleRespond = useCallback(
    async (value: ResponseValue) => {
      const item = displayItem;
      if (!item || finalizing || feedback || inFlightItemId.current === item.id) {
        return;
      }

      inFlightItemId.current = item.id;
      setError(null);

      const responseTimeMs = Date.now() - cardShownAt.current;

      try {
        const response = await fetch("/api/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            itemId: item.id,
            value,
            responseTimeMs,
          }),
        });

        const data = (await response.json()) as SaveResponseResult & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to save response");
        }

        const { predictionFeedback, ...session } = data;

        if (predictionFeedback) {
          setFeedback(predictionFeedback);
          setState((prev) => ({
            ...prev,
            answeredCount: session.answeredCount,
            unansweredCount: session.unansweredCount,
            canFinalize: session.canFinalize,
            predictionStats: session.predictionStats,
          }));
          feedbackTimeout.current = setTimeout(() => {
            setFeedback(null);
            setState(session);
            inFlightItemId.current = null;
          }, 1200);
        } else {
          setState(session);
          inFlightItemId.current = null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        await refreshSession();
        inFlightItemId.current = null;
      }
    },
    [sessionId, displayItem, finalizing, feedback, refreshSession],
  );

  async function handleRetryBatch() {
    setError(null);
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/generate-batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retry: true }),
        },
      );

      const data = await response.json();
      if (data.session) {
        setState(data.session as SessionState);
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to retry batch generation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/finalize`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to finalize session");
      }

      setState(data as SessionState);
      router.push(`/sessions/${sessionId}/results`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finalization failed");
      setFinalizing(false);
    }
  }

  async function handlePredictAll() {
    setError(null);
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/predict-all`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to start predict all");
      }

      if (data.session) {
        setState(data.session as SessionState);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Predict all failed");
    }
  }

  useEffect(() => {
    if (!state.predictionStats.predictAllRunning) {
      return;
    }

    const interval = setInterval(() => {
      void refreshSession();
    }, 1500);

    return () => clearInterval(interval);
  }, [state.predictionStats.predictAllRunning, refreshSession]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (finalizing || !displayItem || feedback) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void handleRespond("negative");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        void handleRespond("positive");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        void handleRespond("neutral");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRespond, finalizing, displayItem, feedback]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <ProgressHeader
        answeredCount={state.answeredCount}
        unansweredCount={state.unansweredCount}
        isGenerating={state.isGenerating}
        canFinalize={state.canFinalize}
        onFinalize={handleFinalize}
        onPredictAll={handlePredictAll}
        finalizing={finalizing}
        predictionStats={state.predictionStats}
      />

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {state.failedBatch && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="font-medium text-red-800">
            Couldn&apos;t generate the next batch.
          </p>
          {state.failedBatch.error && (
            <p className="mt-1 text-sm text-red-600">
              {state.failedBatch.error}
            </p>
          )}
          <button
            type="button"
            onClick={handleRetryBatch}
            className="mt-4 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {finalizing ? (
        <LoadingState
          message="Getting your answer…"
          submessage="Synthesizing everything you swiped on"
        />
      ) : waitingForCards ? (
        <LoadingState
          message="One moment…"
          submessage="Sorry for the wait — we're preparing your next cards."
        />
      ) : displayItem ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-4">
          <div className="relative w-full max-w-lg">
            <SwipeCard item={displayItem} />
            {feedback && (
              <PredictionFeedback
                predicted={feedback.predicted}
                actual={feedback.actual}
                correct={feedback.correct}
              />
            )}
          </div>
          <ResponseButtons
            negativeLabel={displayItem.negativeLabel}
            neutralLabel={displayItem.neutralLabel}
            positiveLabel={displayItem.positiveLabel}
            onRespond={handleRespond}
            disabled={Boolean(feedback)}
          />
        </div>
      ) : (
        <LoadingState message="Loading session…" />
      )}
    </div>
  );
}
