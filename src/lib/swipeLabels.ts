import type { ResponseValue } from "./tasteTestSchemas";

export const DEFAULT_SWIPE_LABELS = {
  negative: "Disagree",
  positive: "Agree",
  neutral: "Not sure",
} as const;

const GENERIC_NEUTRAL_LABELS = new Set([
  "left",
  "right",
  "down",
  "negative",
  "positive",
  "neutral",
  "yes",
  "no",
  "y",
  "n",
  "maybe",
  "skip",
  "pass",
  "nah",
  "yep",
  "nope",
  "agree",
  "disagree",
  "unsure",
  "idk",
  "unknown",
  "not sure",
]);

function isGenericNeutralLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return true;
  if (GENERIC_NEUTRAL_LABELS.has(normalized)) return true;
  if (/^(left|right|negative|positive|neutral)\b/.test(normalized)) return true;
  return false;
}

function pickNeutralLabel(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 28 || isGenericNeutralLabel(trimmed)) {
    return DEFAULT_SWIPE_LABELS.neutral;
  }
  return trimmed;
}

export function normalizeSwipeLabels(input: {
  positiveLabel?: string | null;
  negativeLabel?: string | null;
  neutralLabel?: string | null;
}): {
  positiveLabel: string;
  negativeLabel: string;
  neutralLabel: string;
} {
  return {
    negativeLabel: DEFAULT_SWIPE_LABELS.negative,
    positiveLabel: DEFAULT_SWIPE_LABELS.positive,
    neutralLabel: pickNeutralLabel(input.neutralLabel),
  };
}

export function normalizeTaskSpecLabels(taskSpec: {
  positiveLabel: string;
  negativeLabel: string;
  neutralLabel: string;
}): {
  positiveLabel: string;
  negativeLabel: string;
  neutralLabel: string;
} {
  return normalizeSwipeLabels(taskSpec);
}

export function responseValueToLabel(value: ResponseValue): string {
  switch (value) {
    case "positive":
      return DEFAULT_SWIPE_LABELS.positive;
    case "negative":
      return DEFAULT_SWIPE_LABELS.negative;
    case "neutral":
      return DEFAULT_SWIPE_LABELS.neutral;
  }
}
