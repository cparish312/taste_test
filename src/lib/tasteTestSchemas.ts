import { z } from "zod";

export const responseValueSchema = z.enum(["positive", "negative", "neutral"]);
export type ResponseValue = z.infer<typeof responseValueSchema>;

export const taskSpecSchema = z.object({
  goal: z.string(),
  itemStrategy: z.string(),
  positiveMeaning: z.string(),
  negativeMeaning: z.string(),
  neutralMeaning: z.string(),
  positiveLabel: z.string(),
  negativeLabel: z.string(),
  neutralLabel: z.string(),
  adaptationStrategy: z.string(),
  finalAnswerInstruction: z.string(),
  suggestedMinimumResponses: z.number().int().positive(),
  stoppingGuidance: z.string(),
});

export type TaskSpec = z.infer<typeof taskSpecSchema>;

export const cardTypeSchema = z.enum(["text", "image"]);

export const batchItemLLMSchema = z.object({
  type: cardTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  positiveLabel: z.preprocess(
    (value) => (value === undefined ? null : value),
    z.string().nullable(),
  ),
  negativeLabel: z.preprocess(
    (value) => (value === undefined ? null : value),
    z.string().nullable(),
  ),
  neutralLabel: z.preprocess(
    (value) => (value === undefined ? null : value),
    z.string().nullable(),
  ),
  hiddenPurpose: z.string().min(1),
  targetDimensionId: z.preprocess(
    (value) => (value === undefined ? null : value),
    z.string().nullable(),
  ),
  imageSearchQuery: z.preprocess(
    (value) => (value === undefined ? null : value),
    z.string().nullable(),
  ),
});

export const batchOutputLLMSchema = z.object({
  strategySummary: z.string().min(1),
  items: z.array(batchItemLLMSchema).length(5),
});

export const batchItemSchema = z.object({
  type: cardTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  positiveLabel: z.string().min(1),
  negativeLabel: z.string().min(1),
  neutralLabel: z.string().min(1),
  hiddenPurpose: z.string().min(1),
  imageUrl: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const batchOutputSchema = z.object({
  strategySummary: z.string().min(1),
  items: z.array(batchItemSchema).length(5),
});

export type BatchOutput = z.infer<typeof batchOutputSchema>;

export const finalAnswerSchema = z.object({
  answer: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string().min(1),
  notablePatterns: z.array(z.string()),
  suggestedNextTests: z.array(z.string()),
});

export type FinalAnswer = z.infer<typeof finalAnswerSchema>;

export const createSessionBodySchema = z.object({
  userPrompt: z.string().trim().min(1, "Prompt is required"),
});

export const createResponseBodySchema = z.object({
  sessionId: z.string().min(1),
  itemId: z.string().min(1),
  value: responseValueSchema,
  responseTimeMs: z.number().int().nonnegative().optional(),
});

export type SessionStatus = "active" | "finalizing" | "complete";
export type BatchStatus = "generating" | "complete" | "failed";

export const MIN_ANSWERED_FOR_PREDICTION = 5;
export const MIN_ANSWERED_TO_FINALIZE = 5;

export type PredictionStats = {
  enabled: boolean;
  predictAllRunning: boolean;
  overall: {
    correct: number;
    total: number;
    percent: number | null;
  };
  last5: {
    correct: number;
    total: number;
    percent: number | null;
  };
};

export const responsePredictionSchema = z.object({
  prediction: responseValueSchema,
});

export type SessionItem = {
  id: string;
  sessionId: string;
  batchId: string;
  batchNumber: number;
  indexInBatch: number;
  type: string;
  title: string;
  body: string;
  imageUrl: string | null;
  positiveLabel: string;
  negativeLabel: string;
  neutralLabel: string;
  hiddenPurpose: string | null;
  metadata: unknown;
  createdAt: string;
  response: {
    id: string;
    value: ResponseValue;
    responseTimeMs: number | null;
    createdAt: string;
  } | null;
};

export type SessionState = {
  id: string;
  userPrompt: string;
  taskSpec: TaskSpec;
  status: SessionStatus;
  finalAnswer: string | null;
  finalData: FinalAnswer | null;
  createdAt: string;
  updatedAt: string;
  items: SessionItem[];
  answeredCount: number;
  unansweredCount: number;
  queue: SessionItem[];
  currentItem: SessionItem | null;
  isGenerating: boolean;
  generatingBatchNumber: number | null;
  failedBatch: {
    id: string;
    number: number;
    error: string | null;
  } | null;
  canFinalize: boolean;
  suggestedMinimumResponses: number;
  predictionStats: PredictionStats;
};
