import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  createInitialInferenceState,
  updateInferenceState,
  type ResponseSnapshot,
} from "./openai";
import {
  inferenceStateSchema,
  initialInferenceFromLLM,
  mergeInferenceState,
  type InferenceState,
} from "./inferenceSchemas";
import { taskSpecSchema, type TaskSpec } from "./tasteTestSchemas";

export function parseInferenceState(value: unknown): InferenceState | null {
  if (!value) return null;
  const parsed = inferenceStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function bootstrapInferenceState(
  userPrompt: string,
  taskSpec: TaskSpec,
): Promise<InferenceState> {
  const initial = await createInitialInferenceState(userPrompt, taskSpec);
  return initialInferenceFromLLM(initial);
}

export async function getSessionInferenceState(
  sessionId: string,
): Promise<InferenceState | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { inferenceState: true },
  });

  return parseInferenceState(session?.inferenceState);
}

async function getUnprocessedResponses(
  sessionId: string,
  cursor: number,
): Promise<ResponseSnapshot[]> {
  const items = await prisma.item.findMany({
    where: {
      sessionId,
      response: { isNot: null },
    },
    include: { response: true, batch: true },
    orderBy: [{ batch: { number: "asc" } }, { indexInBatch: "asc" }],
  });

  return items.slice(cursor).map((item) => ({
    title: item.title,
    body: item.body,
    hiddenPurpose: item.hiddenPurpose,
    response: item.response!.value as ResponseSnapshot["response"],
    positiveLabel: item.positiveLabel,
    negativeLabel: item.negativeLabel,
    neutralLabel: item.neutralLabel,
  }));
}

export async function syncInferenceState(sessionId: string): Promise<InferenceState> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const currentState = parseInferenceState(session.inferenceState);
  if (!currentState) {
    throw new Error("Inference state is missing for session");
  }

  const responseCount = await prisma.response.count({
    where: { sessionId },
  });

  if (responseCount <= session.inferenceResponseCursor) {
    return currentState;
  }

  const newResponses = await getUnprocessedResponses(
    sessionId,
    session.inferenceResponseCursor,
  );

  if (newResponses.length === 0) {
    return currentState;
  }

  const taskSpec = taskSpecSchema.parse(session.taskSpec);
  const delta = await updateInferenceState(
    session.userPrompt,
    taskSpec,
    currentState,
    newResponses,
  );

  const nextState = mergeInferenceState(currentState, delta);

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      inferenceState: nextState as unknown as Prisma.InputJsonValue,
      inferenceResponseCursor: responseCount,
    },
  });

  return nextState;
}

export async function ensureInferenceState(sessionId: string): Promise<InferenceState> {
  const existing = await getSessionInferenceState(sessionId);
  if (existing) {
    return existing;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const taskSpec = taskSpecSchema.parse(session.taskSpec);
  const bootstrapped = await bootstrapInferenceState(session.userPrompt, taskSpec);

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      inferenceState: bootstrapped as unknown as Prisma.InputJsonValue,
      inferenceResponseCursor: 0,
    },
  });

  return bootstrapped;
}
