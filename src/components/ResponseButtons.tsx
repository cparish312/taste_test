import type { ResponseValue } from "@/lib/tasteTestSchemas";

type ResponseButtonsProps = {
  negativeLabel: string;
  neutralLabel: string;
  positiveLabel: string;
  onRespond: (value: ResponseValue) => void;
  disabled?: boolean;
};

export function ResponseButtons({
  negativeLabel,
  neutralLabel,
  positiveLabel,
  onRespond,
  disabled = false,
}: ResponseButtonsProps) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onRespond("negative")}
          disabled={disabled}
          className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-5 text-base font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60 sm:text-lg"
        >
          ← {negativeLabel}
        </button>
        <button
          type="button"
          onClick={() => onRespond("positive")}
          disabled={disabled}
          className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-5 text-base font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-60 sm:text-lg"
        >
          {positiveLabel} →
        </button>
      </div>
      <button
        type="button"
        onClick={() => onRespond("neutral")}
        disabled={disabled}
        className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-4 text-base font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-60 sm:text-lg"
      >
        ↓ {neutralLabel}
      </button>
      <p className="text-center text-xs text-zinc-400">
        Keyboard: ← Disagree · ↓ Not sure · → Agree
      </p>
    </div>
  );
}
