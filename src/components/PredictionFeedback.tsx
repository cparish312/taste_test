import { responseValueToLabel } from "@/lib/swipeLabels";
import type { ResponseValue } from "@/lib/tasteTestSchemas";

type PredictionFeedbackProps = {
  predicted: ResponseValue;
  actual: ResponseValue;
  correct: boolean;
};

export function PredictionFeedback({
  predicted,
  actual,
  correct,
}: PredictionFeedbackProps) {
  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl px-6 text-center backdrop-blur-sm ${
        correct ? "bg-emerald-500/90" : "bg-red-500/90"
      }`}
    >
      <p className="text-lg font-semibold text-white">
        {correct ? "Prediction correct" : "Prediction missed"}
      </p>
      <p className="mt-2 text-sm text-white/90">
        Predicted: {responseValueToLabel(predicted)}
      </p>
      <p className="mt-1 text-sm text-white/90">
        You chose: {responseValueToLabel(actual)}
      </p>
    </div>
  );
}
