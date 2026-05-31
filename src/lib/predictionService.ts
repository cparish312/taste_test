import { prisma } from "./prisma";
import { predictUserResponse, type HistoryEntry } from "./openai";
import {
  taskSpecSchema,
  MIN_ANSWERED_FOR_PREDICTION,
  type PredictionStats,
  type ResponseValue,
  type TaskSpec,
} from "./tasteTestSchemas";

export { MIN_ANSWERED_FOR_PREDICTION };

function percent(correct: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((correct / total) * 100);
}

function itemToHistoryEntry(
  item: {
    type: string;
    title: string;
    body: string;
    imageUrl: string | null;
    positiveLabel: string;
    negativeLabel: string;
    neutralLabel: string;
    hiddenPurpose: string | null;
    response: { value: string };
  },
): HistoryEntry {
  return {
    type: item.type as "text" | "image",
    title: item.title,
    body: item.body,
    imageUrl: item.imageUrl,
    positiveLabel: item.positiveLabel,
    negativeLabel: item.negativeLabel,
    neutralLabel: item.neutralLabel,
    hiddenPurpose: item.hiddenPurpose,
    response: item.response.value as HistoryEntry["response"],
  };
}

async function getScoredPredictionsInCardOrder(sessionId: string) {
  const items = await prisma.item.findMany({
    where: {
      sessionId,
      response: { isNot: null },
      prediction: { is: { correct: { not: null } } },
    },
    include: { response: true, prediction: true, batch: true },
    orderBy: [{ batch: { number: "asc" } }, { indexInBatch: "asc" }],
  });

  return items.map((item) => item.prediction!);
}

export async function getPredictionStats(
  sessionId: string,
  answeredCount: number,
  predictAllStatus = "idle",
): Promise<PredictionStats> {
  const scored = await getScoredPredictionsInCardOrder(sessionId);

  const overallCorrect = scored.filter((entry) => entry.correct).length;
  const last5 = scored.slice(-5);
  const last5Correct = last5.filter((entry) => entry.correct).length;

  return {
    enabled: answeredCount >= MIN_ANSWERED_FOR_PREDICTION,
    predictAllRunning: predictAllStatus === "running",
    overall: {
      correct: overallCorrect,
      total: scored.length,
      percent: percent(overallCorrect, scored.length),
    },
    last5: {
      correct: last5Correct,
      total: last5.length,
      percent: percent(last5Correct, last5.length),
    },
  };
}

async function buildHistoryBeforeItem(
  sessionId: string,
  itemId: string,
): Promise<HistoryEntry[]> {
  const items = await prisma.item.findMany({
    where: { sessionId },
    include: { response: true, batch: true },
    orderBy: [{ batch: { number: "asc" } }, { indexInBatch: "asc" }],
  });

  return items
    .filter(
      (
        item,
      ): item is typeof item & {
        response: NonNullable<(typeof item)["response"]>;
      } => item.id !== itemId && item.response !== null,
    )
    .map((item) => itemToHistoryEntry(item));
}

export async function ensurePrediction(
  sessionId: string,
  itemId: string,
): Promise<ResponseValue | null> {
  const answeredCount = await prisma.response.count({ where: { sessionId } });
  if (answeredCount < MIN_ANSWERED_FOR_PREDICTION) {
    return null;
  }

  const item = await prisma.item.findFirst({
    where: { id: itemId, sessionId },
    include: { response: true, prediction: true },
  });

  if (!item || item.response) {
    return null;
  }

  if (item.prediction) {
    return item.prediction.predicted as ResponseValue;
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new Error("Session not found");
  }

  const history = await buildHistoryBeforeItem(sessionId, itemId);
  if (history.length < MIN_ANSWERED_FOR_PREDICTION) {
    return null;
  }

  const taskSpec = taskSpecSchema.parse(session.taskSpec);
  const currentCard = {
    type: item.type,
    title: item.title,
    body: item.body,
    imageUrl: item.imageUrl,
    positiveLabel: item.positiveLabel,
    negativeLabel: item.negativeLabel,
    neutralLabel: item.neutralLabel,
    hiddenPurpose: item.hiddenPurpose,
  };

  const predicted = await predictUserResponse(
    session.userPrompt,
    taskSpec,
    history,
    currentCard,
  );

  await prisma.prediction.create({
    data: {
      sessionId,
      itemId,
      predicted,
    },
  });

  return predicted;
}

export async function scorePrediction(
  sessionId: string,
  itemId: string,
  actual: ResponseValue,
): Promise<void> {
  const prediction = await prisma.prediction.findUnique({
    where: { itemId },
  });

  if (!prediction || prediction.sessionId !== sessionId) {
    return;
  }

  await prisma.prediction.update({
    where: { itemId },
    data: {
      actual,
      correct: prediction.predicted === actual,
    },
  });
}

async function predictItemLeaveOneOut(
  sessionId: string,
  userPrompt: string,
  taskSpec: TaskSpec,
  item: {
    id: string;
    type: string;
    title: string;
    body: string;
    imageUrl: string | null;
    positiveLabel: string;
    negativeLabel: string;
    neutralLabel: string;
    hiddenPurpose: string | null;
    response: { value: string };
  },
): Promise<void> {
  const history = await buildHistoryBeforeItem(sessionId, item.id);
  const actual = item.response.value as ResponseValue;

  const predicted = await predictUserResponse(
    userPrompt,
    taskSpec,
    history,
    {
      type: item.type,
      title: item.title,
      body: item.body,
      imageUrl: item.imageUrl,
      positiveLabel: item.positiveLabel,
      negativeLabel: item.negativeLabel,
      neutralLabel: item.neutralLabel,
      hiddenPurpose: item.hiddenPurpose,
    },
  );

  await prisma.prediction.upsert({
    where: { itemId: item.id },
    create: {
      sessionId,
      itemId: item.id,
      predicted,
      actual,
      correct: predicted === actual,
    },
    update: {
      predicted,
      actual,
      correct: predicted === actual,
    },
  });
}

export async function runPredictAll(sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new Error("Session not found");
  }

  const answeredCount = await prisma.response.count({ where: { sessionId } });
  if (answeredCount < MIN_ANSWERED_FOR_PREDICTION) {
    throw new Error("At least 5 answered cards are required");
  }

  const taskSpec = taskSpecSchema.parse(session.taskSpec);
  const answeredItems = await prisma.item.findMany({
    where: { sessionId, response: { isNot: null } },
    include: { response: true, batch: true },
    orderBy: [{ batch: { number: "asc" } }, { indexInBatch: "asc" }],
  });

  for (const item of answeredItems) {
    if (!item.response) continue;
    await predictItemLeaveOneOut(
      sessionId,
      session.userPrompt,
      taskSpec,
      { ...item, response: item.response },
    );
  }
}

export async function startPredictAll(sessionId: string): Promise<"started" | "already_running"> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new Error("Session not found");
  }

  if (session.predictAllStatus === "running") {
    return "already_running";
  }

  const answeredCount = await prisma.response.count({ where: { sessionId } });
  if (answeredCount < MIN_ANSWERED_FOR_PREDICTION) {
    throw new Error("At least 5 answered cards are required");
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { predictAllStatus: "running" },
  });

  void executePredictAll(sessionId);

  return "started";
}

async function executePredictAll(sessionId: string): Promise<void> {
  try {
    await runPredictAll(sessionId);
    await prisma.session.update({
      where: { id: sessionId },
      data: { predictAllStatus: "complete" },
    });
  } catch (error) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { predictAllStatus: "failed" },
    });
    console.error(`Predict all failed for session ${sessionId}:`, error);
  }
}
