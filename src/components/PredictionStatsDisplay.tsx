import type { PredictionStats } from "@/lib/tasteTestSchemas";

type PredictionStatsDisplayProps = {
  stats: PredictionStats;
};

function formatPercent(percent: number | null): string {
  if (percent === null) return "—";
  return `${percent}%`;
}

function LoadingSpinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin text-zinc-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function PredictionStatsDisplay({ stats }: PredictionStatsDisplayProps) {
  if (!stats.enabled && stats.overall.total === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1 text-right text-xs text-zinc-600">
      <div className="flex items-center gap-2">
        <span className="font-medium text-zinc-500">Overall</span>
        {stats.predictAllRunning ? (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-500">
            <LoadingSpinner />
            <span>Updating…</span>
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-800">
            {formatPercent(stats.overall.percent)}
          </span>
        )}
        {!stats.predictAllRunning && (
          <span className="text-zinc-400">
            ({stats.overall.correct}/{stats.overall.total})
          </span>
        )}
      </div>
      {stats.last5.total > 0 && !stats.predictAllRunning && (
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-500">Last 5</span>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-800">
            {formatPercent(stats.last5.percent)}
          </span>
          <span className="text-zinc-400">
            ({stats.last5.correct}/{stats.last5.total})
          </span>
        </div>
      )}
    </div>
  );
}
