import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  inferenceStateDeltaSchema,
  initialInferenceStateLLMSchema,
  type InferenceState,
  type InferenceStateDelta,
  type InitialInferenceStateLLM,
} from "./inferenceSchemas";
import {
  batchOutputLLMSchema,
  batchOutputSchema,
  finalAnswerSchema,
  responsePredictionSchema,
  taskSpecSchema,
  type BatchOutput,
  type FinalAnswer,
  type ResponseValue,
  type TaskSpec,
} from "./tasteTestSchemas";
import { enrichBatchItemsWithImages } from "./imageService";
import { normalizeSwipeLabels, normalizeTaskSpecLabels } from "./swipeLabels";
import {
  createInitialInferenceStatePrompt,
  createTaskSpecPrompt,
  finalizeSessionPrompt,
  generateBatchPrompt,
  predictResponsePrompt,
  updateInferenceStatePrompt,
} from "./tasteTestPrompts";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

function getModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
}

/** Smarter model for bootstrapping/updating inference dimensions and belief state. */
function getDimensionModel(): string {
  return process.env.OPENAI_DIMENSION_MODEL ?? "gpt-5.1";
}

/** Smarter model for the final answer / recommendation. */
function getFinalModel(): string {
  return process.env.OPENAI_FINAL_MODEL ?? "gpt-5.1";
}

/** Model for predicting user swipe responses. */
function getPredictionModel(): string {
  return process.env.OPENAI_PREDICTION_MODEL ?? "gpt-5.4-mini";
}

export type CurrentCard = {
  type: string;
  title: string;
  body: string;
  imageUrl: string | null;
  positiveLabel: string;
  negativeLabel: string;
  neutralLabel: string;
  hiddenPurpose: string | null;
};

export type HistoryEntry = {
  type: "text" | "image";
  title: string;
  body: string;
  imageUrl: string | null;
  positiveLabel: string;
  negativeLabel: string;
  neutralLabel: string;
  hiddenPurpose: string | null;
  response: "positive" | "negative" | "neutral" | null;
};

export type ResponseSnapshot = {
  title: string;
  body: string;
  hiddenPurpose: string | null;
  response: "positive" | "negative" | "neutral";
  positiveLabel: string;
  negativeLabel: string;
  neutralLabel: string;
};

async function parseStructuredResponse<T>(
  completion: OpenAI.Chat.Completions.ChatCompletion,
  schema: { parse: (data: unknown) => T },
  label: string,
): Promise<T> {
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`OpenAI returned empty content for ${label}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`OpenAI returned invalid JSON for ${label}`);
  }

  return schema.parse(parsed);
}

export async function createTaskSpec(userPrompt: string): Promise<TaskSpec> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content:
          "You design adaptive swipe sessions. Swipes react to probe cards, not the final answer. Return structured JSON only.",
      },
      {
        role: "user",
        content: createTaskSpecPrompt(userPrompt),
      },
    ],
    response_format: zodResponseFormat(taskSpecSchema, "task_spec"),
  });

  const spec = await parseStructuredResponse(completion, taskSpecSchema, "task spec");
  return { ...spec, ...normalizeTaskSpecLabels(spec) };
}

export async function createInitialInferenceState(
  userPrompt: string,
  taskSpec: TaskSpec,
): Promise<InitialInferenceStateLLM> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: getDimensionModel(),
    messages: [
      {
        role: "system",
        content:
          "You bootstrap inference models for adaptive sessions. Identify gating dimensions and put them first in nextFocus. Return structured JSON only.",
      },
      {
        role: "user",
        content: createInitialInferenceStatePrompt(
          userPrompt,
          JSON.stringify(taskSpec, null, 2),
        ),
      },
    ],
    response_format: zodResponseFormat(
      initialInferenceStateLLMSchema,
      "initial_inference_state",
    ),
  });

  return parseStructuredResponse(
    completion,
    initialInferenceStateLLMSchema,
    "initial inference state",
  );
}

export async function updateInferenceState(
  userPrompt: string,
  taskSpec: TaskSpec,
  currentState: InferenceState,
  newResponses: ResponseSnapshot[],
): Promise<InferenceStateDelta> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: getDimensionModel(),
    messages: [
      {
        role: "system",
        content:
          "You update inference state via minimal deltas. You may add or remove dimensions as needed. Return structured JSON only.",
      },
      {
        role: "user",
        content: updateInferenceStatePrompt(
          userPrompt,
          JSON.stringify(taskSpec, null, 2),
          JSON.stringify(currentState, null, 2),
          JSON.stringify(newResponses, null, 2),
        ),
      },
    ],
    response_format: zodResponseFormat(
      inferenceStateDeltaSchema,
      "inference_state_delta",
    ),
  });

  return parseStructuredResponse(
    completion,
    inferenceStateDeltaSchema,
    "inference state delta",
  );
}

export async function generateBatch(
  userPrompt: string,
  taskSpec: TaskSpec,
  inferenceState: InferenceState,
  previousItems: HistoryEntry[],
  batchNumber: number,
): Promise<BatchOutput> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content:
          "You generate preference probe cards optimized for information gain with personality. Each card: one clear claim, real character in the wording. Include 2-3 image cards per batch when visuals help. Agree and disagree probes. Default buttons: Disagree/Agree/Not sure. Return exactly 5 items as structured JSON.",
      },
      {
        role: "user",
        content: generateBatchPrompt(
          userPrompt,
          JSON.stringify(taskSpec, null, 2),
          JSON.stringify(inferenceState, null, 2),
          JSON.stringify(previousItems, null, 2),
          batchNumber,
        ),
      },
    ],
    response_format: zodResponseFormat(batchOutputLLMSchema, "batch_output"),
  });

  const llmOutput = await parseStructuredResponse(
    completion,
    batchOutputLLMSchema,
    "batch",
  );

  const preparedItems = llmOutput.items.map((item) => {
    const labels = normalizeSwipeLabels(item);
    return {
      type: item.type,
      title: item.title,
      body: item.body,
      positiveLabel: labels.positiveLabel,
      negativeLabel: labels.negativeLabel,
      neutralLabel: labels.neutralLabel,
      hiddenPurpose: item.hiddenPurpose,
      imageSearchQuery: item.imageSearchQuery,
      metadata:
        item.targetDimensionId !== null && item.targetDimensionId.length > 0
          ? { targetDimensionId: item.targetDimensionId }
          : {},
    };
  });

  const enrichedItems = await enrichBatchItemsWithImages(preparedItems);

  return batchOutputSchema.parse({
    strategySummary: llmOutput.strategySummary,
    items: enrichedItems.map((item) => ({
      type: item.type,
      title: item.title,
      body: item.body,
      positiveLabel: item.positiveLabel,
      negativeLabel: item.negativeLabel,
      neutralLabel: item.neutralLabel,
      hiddenPurpose: item.hiddenPurpose,
      imageUrl: item.imageUrl,
      metadata: item.metadata,
    })),
  });
}

export async function finalizeSession(
  userPrompt: string,
  taskSpec: TaskSpec,
  inferenceState: InferenceState,
  items: HistoryEntry[],
): Promise<FinalAnswer> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: getFinalModel(),
    messages: [
      {
        role: "system",
        content:
          "You synthesize inference state into a direct final answer. Name specific real people, titles, or entities — never vague archetypes alone. Return structured JSON only.",
      },
      {
        role: "user",
        content: finalizeSessionPrompt(
          userPrompt,
          JSON.stringify(taskSpec, null, 2),
          JSON.stringify(inferenceState, null, 2),
          JSON.stringify(items, null, 2),
        ),
      },
    ],
    response_format: zodResponseFormat(finalAnswerSchema, "final_answer"),
  });

  return parseStructuredResponse(completion, finalAnswerSchema, "final answer");
}

export async function predictUserResponse(
  userPrompt: string,
  taskSpec: TaskSpec,
  history: HistoryEntry[],
  currentCard: CurrentCard,
): Promise<ResponseValue> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: getPredictionModel(),
    messages: [
      {
        role: "system",
        content:
          "You predict user swipe responses from prior behavior. Return structured JSON only.",
      },
      {
        role: "user",
        content: predictResponsePrompt(
          userPrompt,
          JSON.stringify(taskSpec, null, 2),
          JSON.stringify(history, null, 2),
          JSON.stringify(currentCard, null, 2),
        ),
      },
    ],
    response_format: zodResponseFormat(responsePredictionSchema, "response_prediction"),
  });

  const result = await parseStructuredResponse(
    completion,
    responsePredictionSchema,
    "predictUserResponse",
  );
  return result.prediction;
}
