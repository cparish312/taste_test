import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { syncInferenceState, ensureInferenceState } from "./inferenceService";
import { generateBatch, type HistoryEntry } from "./openai";
import { taskSpecSchema } from "./tasteTestSchemas";

const UNANSWERED_THRESHOLD = 2;
const BATCH_SIZE = 5;

export function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function buildHistory(sessionId: string): Promise<HistoryEntry[]> {
  const items = await prisma.item.findMany({
    where: { sessionId },
    include: { response: true, batch: true },
    orderBy: [{ batch: { number: "asc" } }, { indexInBatch: "asc" }],
  });

  return items.map((item) => ({
    type: item.type as "text" | "image",
    title: item.title,
    body: item.body,
    imageUrl: item.imageUrl,
    positiveLabel: item.positiveLabel,
    negativeLabel: item.negativeLabel,
    neutralLabel: item.neutralLabel,
    hiddenPurpose: item.hiddenPurpose,
    response: item.response?.value as HistoryEntry["response"],
  }));
}

async function persistBatchItems(
  sessionId: string,
  batchId: string,
  batchOutput: Awaited<ReturnType<typeof generateBatch>>,
) {
  await prisma.$transaction(
    batchOutput.items.map((item, index) =>
      prisma.item.create({
        data: {
          sessionId,
          batchId,
          indexInBatch: index,
          type: item.type,
          title: item.title,
          body: item.body,
          imageUrl: item.imageUrl,
          positiveLabel: item.positiveLabel,
          negativeLabel: item.negativeLabel,
          neutralLabel: item.neutralLabel,
          hiddenPurpose: item.hiddenPurpose,
          metadata: item.metadata as Prisma.InputJsonValue,
        },
      }),
    ),
  );
}

type ReserveResult =
  | {
      reserved: true;
      batchId: string;
      batchNumber: number;
    }
  | {
      reserved: false;
      reason: string;
      batchId?: string;
      batchNumber?: number;
    };

export async function reserveNextBatch(
  sessionId: string,
): Promise<ReserveResult> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status !== "active") {
    return { reserved: false, reason: "session_not_active" };
  }

  const generatingBatch = await prisma.batch.findFirst({
    where: { sessionId, status: "generating" },
  });

  if (generatingBatch) {
    return {
      reserved: false,
      reason: "already_generating",
      batchId: generatingBatch.id,
      batchNumber: generatingBatch.number,
    };
  }

  const responseCount = await prisma.response.count({ where: { sessionId } });
  const unansweredCount = await prisma.item.count({
    where: { sessionId, response: null },
  });

  const lastCompleteBatch = await prisma.batch.findFirst({
    where: { sessionId, status: "complete" },
    orderBy: { number: "desc" },
  });

  const isInitialBatch = !lastCompleteBatch;
  if (!isInitialBatch && unansweredCount > UNANSWERED_THRESHOLD) {
    return { reserved: false, reason: "queue_sufficient" };
  }

  const maxBatch = await prisma.batch.aggregate({
    where: { sessionId },
    _max: { number: true },
  });
  const nextNumber = (maxBatch._max.number ?? 0) + 1;

  try {
    const batch = await prisma.batch.create({
      data: {
        sessionId,
        number: nextNumber,
        status: "generating",
        basedOnCount: responseCount,
      },
    });

    return {
      reserved: true,
      batchId: batch.id,
      batchNumber: batch.number,
    };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      const existing = await prisma.batch.findFirst({
        where: { sessionId, status: "generating" },
      });
      return {
        reserved: false,
        reason: "already_generating",
        batchId: existing?.id,
        batchNumber: existing?.number,
      };
    }
    throw error;
  }
}

export async function fillReservedBatch(
  sessionId: string,
  batchId: string,
): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
  });

  if (!batch || batch.status !== "generating") {
    return;
  }

  const taskSpec = taskSpecSchema.parse(session.taskSpec);

  try {
    await ensureInferenceState(sessionId);
    const inferenceState = await syncInferenceState(sessionId);
    const history = await buildHistory(sessionId);
    const batchOutput = await generateBatch(
      session.userPrompt,
      taskSpec,
      inferenceState,
      history,
      batch.number,
    );

    await persistBatchItems(sessionId, batchId, batchOutput);

    await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: "complete",
        strategySummary: batchOutput.strategySummary,
        rawOutput: batchOutput as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown batch generation error";
    console.error(`Batch generation failed for session ${sessionId}:`, error);

    await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: "failed",
        error: message,
      },
    });

    throw error;
  }
}

export async function generateNextBatch(sessionId: string): Promise<{
  started: boolean;
  batchId?: string;
  batchNumber?: number;
  reason?: string;
}> {
  const reserved = await reserveNextBatch(sessionId);

  if (!reserved.reserved) {
    return {
      started: false,
      reason: reserved.reason,
      batchId: reserved.batchId,
      batchNumber: reserved.batchNumber,
    };
  }

  await fillReservedBatch(sessionId, reserved.batchId);

  return {
    started: true,
    batchId: reserved.batchId,
    batchNumber: reserved.batchNumber,
  };
}

export async function maybeTriggerNextBatch(sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });

  if (!session || session.status !== "active") {
    return;
  }

  const unansweredCount = await prisma.item.count({
    where: { sessionId, response: null },
  });

  if (unansweredCount > UNANSWERED_THRESHOLD) {
    return;
  }

  const reserved = await reserveNextBatch(sessionId);
  if (!reserved.reserved) {
    return;
  }

  void fillReservedBatch(sessionId, reserved.batchId).catch((error) => {
    console.error(
      `Background batch generation failed for session ${sessionId}:`,
      error,
    );
  });
}

export async function retryFailedBatch(sessionId: string): Promise<void> {
  const failedBatch = await prisma.batch.findFirst({
    where: { sessionId, status: "failed" },
    orderBy: { number: "desc" },
  });

  if (failedBatch) {
    await prisma.batch.delete({ where: { id: failedBatch.id } });
  }

  const reserved = await reserveNextBatch(sessionId);
  if (!reserved.reserved) {
    return;
  }

  await fillReservedBatch(sessionId, reserved.batchId);
}

export { BATCH_SIZE, UNANSWERED_THRESHOLD };
