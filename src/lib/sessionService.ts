import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { createTaskSpec, finalizeSession } from "./openai";
import { bootstrapInferenceState, syncInferenceState } from "./inferenceService";
import { generateNextBatch, buildHistory } from "./generationService";
import {
  getPredictionStats,
  scorePrediction,
} from "./predictionService";
import {
  taskSpecSchema,
  type FinalAnswer,
  type ResponseValue,
  type SessionItem,
  type SessionState,
  type SessionStatus,
  type TaskSpec,
} from "./tasteTestSchemas";

export type PredictionFeedback = {
  predicted: ResponseValue;
  actual: ResponseValue;
  correct: boolean;
};

export type SaveResponseResult = SessionState & {
  predictionFeedback: PredictionFeedback | null;
};

function serializeItem(
  item: Prisma.ItemGetPayload<{
    include: { response: true; batch: true };
  }>,
): SessionItem {
  return {
    id: item.id,
    sessionId: item.sessionId,
    batchId: item.batchId,
    batchNumber: item.batch.number,
    indexInBatch: item.indexInBatch,
    type: item.type,
    title: item.title,
    body: item.body,
    imageUrl: item.imageUrl,
    positiveLabel: item.positiveLabel,
    negativeLabel: item.negativeLabel,
    neutralLabel: item.neutralLabel,
    hiddenPurpose: item.hiddenPurpose,
    metadata: item.metadata,
    createdAt: item.createdAt.toISOString(),
    response: item.response
      ? {
          id: item.response.id,
          value: item.response.value as ResponseValue,
          responseTimeMs: item.response.responseTimeMs,
          createdAt: item.response.createdAt.toISOString(),
        }
      : null,
  };
}

export async function buildSessionState(
  sessionId: string,
): Promise<SessionState | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      items: {
        include: { response: true, batch: true },
        orderBy: [{ batch: { number: "asc" } }, { indexInBatch: "asc" }],
      },
      batches: {
        orderBy: { number: "desc" },
      },
    },
  });

  if (!session) {
    return null;
  }

  const taskSpec = taskSpecSchema.parse(session.taskSpec) as TaskSpec;
  const items = session.items.map(serializeItem);
  const answeredCount = items.filter((item) => item.response).length;
  const queue = items.filter((item) => !item.response);
  const generatingBatch = session.batches.find(
    (batch) => batch.status === "generating",
  );
  const failedBatch = session.batches.find((batch) => batch.status === "failed");

  const finalData = session.finalData
    ? (session.finalData as FinalAnswer)
    : null;

  const predictionStats = await getPredictionStats(
    sessionId,
    answeredCount,
    session.predictAllStatus,
  );

  return {
    id: session.id,
    userPrompt: session.userPrompt,
    taskSpec,
    status: session.status as SessionStatus,
    finalAnswer: session.finalAnswer,
    finalData,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    items,
    answeredCount,
    unansweredCount: queue.length,
    queue,
    currentItem: queue[0] ?? null,
    isGenerating: Boolean(generatingBatch),
    generatingBatchNumber: generatingBatch?.number ?? null,
    failedBatch: failedBatch
      ? {
          id: failedBatch.id,
          number: failedBatch.number,
          error: failedBatch.error,
        }
      : null,
    canFinalize: answeredCount >= 1 && session.status === "active",
    suggestedMinimumResponses: taskSpec.suggestedMinimumResponses ?? 10,
    predictionStats,
  };
}

export async function createSession(userPrompt: string): Promise<SessionState> {
  const taskSpec = await createTaskSpec(userPrompt);
  const inferenceState = await bootstrapInferenceState(userPrompt, taskSpec);

  const session = await prisma.session.create({
    data: {
      userPrompt,
      taskSpec: taskSpec as unknown as Prisma.InputJsonValue,
      inferenceState: inferenceState as unknown as Prisma.InputJsonValue,
      inferenceResponseCursor: 0,
      status: "active",
    },
  });

  await generateNextBatch(session.id);

  const state = await buildSessionState(session.id);
  if (!state) {
    throw new Error("Failed to load created session");
  }

  return state;
}

export async function saveResponse(input: {
  sessionId: string;
  itemId: string;
  value: ResponseValue;
  responseTimeMs?: number;
}): Promise<SaveResponseResult> {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status !== "active") {
    throw new Error("Session is not active");
  }

  const item = await prisma.item.findFirst({
    where: { id: input.itemId, sessionId: input.sessionId },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  await prisma.response.upsert({
    where: { itemId: input.itemId },
    create: {
      sessionId: input.sessionId,
      itemId: input.itemId,
      value: input.value,
      responseTimeMs: input.responseTimeMs,
    },
    update: {
      value: input.value,
      responseTimeMs: input.responseTimeMs,
    },
  });

  await scorePrediction(input.sessionId, input.itemId, input.value);

  const scoredPrediction = await prisma.prediction.findUnique({
    where: { itemId: input.itemId },
  });

  const { maybeTriggerNextBatch } = await import("./generationService");
  await maybeTriggerNextBatch(input.sessionId);

  const state = await buildSessionState(input.sessionId);
  if (!state) {
    throw new Error("Failed to load session");
  }

  const predictionFeedback =
    scoredPrediction?.predicted && scoredPrediction.correct !== null
      ? {
          predicted: scoredPrediction.predicted as ResponseValue,
          actual: input.value,
          correct: scoredPrediction.correct!,
        }
      : null;

  return {
    ...state,
    predictionFeedback,
  };
}

export async function finalizeSessionById(
  sessionId: string,
): Promise<SessionState> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status === "complete") {
    const state = await buildSessionState(sessionId);
    if (!state) {
      throw new Error("Failed to load session");
    }
    return state;
  }

  const responseCount = await prisma.response.count({
    where: { sessionId },
  });

  if (responseCount < 1) {
    throw new Error("At least one response is required to finalize");
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { status: "finalizing" },
  });

  try {
    const taskSpec = taskSpecSchema.parse(session.taskSpec);
    const inferenceState = await syncInferenceState(sessionId);
    const history = await buildHistory(sessionId);
    const finalData = await finalizeSession(
      session.userPrompt,
      taskSpec,
      inferenceState,
      history,
    );

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "complete",
        finalAnswer: finalData.answer,
        finalData: finalData as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "active" },
    });
    throw error;
  }

  const state = await buildSessionState(sessionId);
  if (!state) {
    throw new Error("Failed to load session");
  }

  return state;
}
