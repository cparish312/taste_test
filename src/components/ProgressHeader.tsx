import type { PredictionStats } from "@/lib/tasteTestSchemas";
import { MIN_ANSWERED_FOR_PREDICTION } from "@/lib/tasteTestSchemas";
import { PredictionStatsDisplay } from "@/components/PredictionStatsDisplay";

type ProgressHeaderProps = {
  answeredCount: number;
  unansweredCount: number;
  isGenerating: boolean;
  canFinalize: boolean;
  onFinalize: () => void;
  onPredictAll: () => void;
  finalizing: boolean;
  predictionStats: PredictionStats;
};

export function ProgressHeader({
  answeredCount,
  unansweredCount,
  isGenerating,
  canFinalize,
  onFinalize,
  onPredictAll,
  finalizing,
  predictionStats,
}: ProgressHeaderProps) {
  const showFinalize = canFinalize;
  const showPredictAll = answeredCount >= MIN_ANSWERED_FOR_PREDICTION;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <span className="rounded-full bg-violet-100 px-3 py-1 font-medium text-violet-700">
          {answeredCount} answered
        </span>
        {unansweredCount > 0 && (
          <span className="text-zinc-500">{unansweredCount} in queue</span>
        )}
        {isGenerating && (
          <span className="animate-pulse text-violet-600">Generating more…</span>
        )}
      </div>

      <div className="flex flex-col items-start gap-3 sm:items-end">
        <PredictionStatsDisplay stats={predictionStats} />
        <div className="flex flex-wrap items-center gap-2">
          {showPredictAll && (
            <button
              type="button"
              onClick={onPredictAll}
              disabled={predictionStats.predictAllRunning || finalizing}
              className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:opacity-60"
            >
              {predictionStats.predictAllRunning ? "Predicting all…" : "Predict all"}
            </button>
          )}
          {showFinalize && (
            <button
              type="button"
              onClick={onFinalize}
              disabled={finalizing || predictionStats.predictAllRunning}
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {finalizing ? "Getting your answer…" : "Get my answer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
