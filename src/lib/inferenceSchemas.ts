import { z } from "zod";

function undefinedToNull<T>(value: unknown): T | null {
  return value === undefined ? null : (value as T);
}

function nullableString() {
  return z.preprocess(
    undefinedToNull,
    z.string().nullable(),
  );
}

function nullableEnum<T extends z.ZodType<string>>(schema: T) {
  return z.preprocess(undefinedToNull, schema.nullable());
}

export const confidenceSchema = z.enum([
  "unknown",
  "low",
  "medium",
  "high",
]);

export const signalSchema = z.enum([
  "unknown",
  "negative",
  "mixed",
  "neutral",
  "positive",
]);

export const importanceSchema = z.enum(["low", "medium", "high"]);

export const constraintStatusSchema = z.enum([
  "unknown",
  "required",
  "preferred",
  "avoid",
  "dealbreaker",
]);

export const dimensionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  importance: importanceSchema,
  confidence: confidenceSchema,
  signal: signalSchema,
  evidence: z.array(z.string()),
});

export const constraintSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: constraintStatusSchema,
  confidence: confidenceSchema,
  evidence: z.array(z.string()),
});

export const hypothesisSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  confidence: confidenceSchema,
  supporting: z.number().int().nonnegative(),
  contradicting: z.number().int().nonnegative(),
  evidence: z.array(z.string()),
});

export const inferenceStateSchema = z.object({
  summary: z.string().min(1),
  dimensions: z.array(dimensionSchema),
  constraints: z.array(constraintSchema),
  hypotheses: z.array(hypothesisSchema),
  openQuestions: z.array(z.string()),
  nextFocus: z.array(z.string()),
  forbiddenCardPatterns: z.array(z.string()),
  updateCount: z.number().int().nonnegative(),
});

export type InferenceState = z.infer<typeof inferenceStateSchema>;
export type Dimension = z.infer<typeof dimensionSchema>;
export type Constraint = z.infer<typeof constraintSchema>;
export type Hypothesis = z.infer<typeof hypothesisSchema>;

const addDimensionLLMSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: nullableString(),
  importance: importanceSchema,
  confidence: confidenceSchema,
  signal: signalSchema,
  evidence: z.array(z.string()),
});

const dimensionUpdateLLMSchema = z.object({
  id: z.string().min(1),
  label: nullableString(),
  description: nullableString(),
  importance: nullableEnum(importanceSchema),
  confidence: nullableEnum(confidenceSchema),
  signal: nullableEnum(signalSchema),
  addEvidence: z.array(z.string()),
});

const addConstraintLLMSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: constraintStatusSchema,
  confidence: confidenceSchema,
  evidence: z.array(z.string()),
});

const constraintUpdateLLMSchema = z.object({
  id: z.string().min(1),
  label: nullableString(),
  status: nullableEnum(constraintStatusSchema),
  confidence: nullableEnum(confidenceSchema),
  addEvidence: z.array(z.string()),
});

const addHypothesisLLMSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  confidence: confidenceSchema,
  supporting: z.number().int().nonnegative(),
  contradicting: z.number().int().nonnegative(),
  evidence: z.array(z.string()),
});

const hypothesisUpdateLLMSchema = z.object({
  id: z.string().min(1),
  label: nullableString(),
  confidence: nullableEnum(confidenceSchema),
  addSupporting: z.number().int().nonnegative(),
  addContradicting: z.number().int().nonnegative(),
  addEvidence: z.array(z.string()),
});

export const inferenceStateDeltaSchema = z.object({
  summary: nullableString(),
  addDimensions: z.array(addDimensionLLMSchema),
  dimensionUpdates: z.array(dimensionUpdateLLMSchema),
  removeDimensionIds: z.array(z.string()),
  addConstraints: z.array(addConstraintLLMSchema),
  constraintUpdates: z.array(constraintUpdateLLMSchema),
  removeConstraintIds: z.array(z.string()),
  addHypotheses: z.array(addHypothesisLLMSchema),
  hypothesisUpdates: z.array(hypothesisUpdateLLMSchema),
  removeHypothesisIds: z.array(z.string()),
  addOpenQuestions: z.array(z.string()),
  removeOpenQuestions: z.array(z.string()),
  setNextFocus: z.array(z.string()),
  addForbiddenCardPatterns: z.array(z.string()),
  removeForbiddenCardPatterns: z.array(z.string()),
});

export type InferenceStateDelta = z.infer<typeof inferenceStateDeltaSchema>;

export const initialInferenceStateLLMSchema = z.object({
  summary: z.string().min(1),
  dimensions: z.array(addDimensionLLMSchema).min(3).max(12),
  constraints: z.array(addConstraintLLMSchema),
  hypotheses: z.array(addHypothesisLLMSchema),
  openQuestions: z.array(z.string()).min(2).max(10),
  nextFocus: z.array(z.string()).min(1).max(3),
  forbiddenCardPatterns: z.array(z.string()).min(1).max(10),
});

export type InitialInferenceStateLLM = z.infer<
  typeof initialInferenceStateLLMSchema
>;

const MAX_EVIDENCE = 5;
const MAX_NEXT_FOCUS = 3;

function dimensionFromLLM(dimension: {
  id: string;
  label: string;
  description: string | null;
  importance: Dimension["importance"];
  confidence: Dimension["confidence"];
  signal: Dimension["signal"];
  evidence: string[];
}): Dimension {
  return {
    id: dimension.id,
    label: dimension.label,
    ...(dimension.description !== null
      ? { description: dimension.description }
      : {}),
    importance: dimension.importance,
    confidence: dimension.confidence,
    signal: dimension.signal,
    evidence: capEvidence(dimension.evidence),
  };
}

function capEvidence(items: string[], max = MAX_EVIDENCE): string[] {
  return items.slice(-max);
}

function upsertById<T extends { id: string }>(
  list: T[],
  item: T,
): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    return [...list, item];
  }
  const next = [...list];
  next[index] = item;
  return next;
}

export function createEmptyInferenceState(): InferenceState {
  return {
    summary: "Session started. No preference signals yet.",
    dimensions: [],
    constraints: [],
    hypotheses: [],
    openQuestions: [],
    nextFocus: [],
    forbiddenCardPatterns: [],
    updateCount: 0,
  };
}

export function initialInferenceFromLLM(
  initial: InitialInferenceStateLLM,
): InferenceState {
  return inferenceStateSchema.parse({
    summary: initial.summary,
    dimensions: initial.dimensions.map(dimensionFromLLM),
    constraints: initial.constraints.map((constraint) => ({
      ...constraint,
      evidence: capEvidence(constraint.evidence, 3),
    })),
    hypotheses: initial.hypotheses.map((hypothesis) => ({
      ...hypothesis,
      evidence: capEvidence(hypothesis.evidence, 3),
    })),
    openQuestions: [...initial.openQuestions],
    nextFocus: initial.nextFocus.slice(0, MAX_NEXT_FOCUS),
    forbiddenCardPatterns: [...initial.forbiddenCardPatterns],
    updateCount: 0,
  });
}

export function mergeInferenceState(
  current: InferenceState,
  delta: InferenceStateDelta,
): InferenceState {
  let dimensions = [...current.dimensions];
  let constraints = [...current.constraints];
  let hypotheses = [...current.hypotheses];
  let openQuestions = [...current.openQuestions];
  let forbiddenCardPatterns = [...current.forbiddenCardPatterns];

  for (const dimension of delta.addDimensions) {
    dimensions = upsertById(dimensions, dimensionFromLLM(dimension));
  }

  for (const update of delta.dimensionUpdates) {
    const existing = dimensions.find((entry) => entry.id === update.id);
    if (!existing) continue;

    dimensions = upsertById(dimensions, {
      ...existing,
      ...(update.label !== null ? { label: update.label } : {}),
      ...(update.description !== null
        ? { description: update.description }
        : {}),
      ...(update.importance !== null
        ? { importance: update.importance }
        : {}),
      ...(update.confidence !== null
        ? { confidence: update.confidence }
        : {}),
      ...(update.signal !== null ? { signal: update.signal } : {}),
      evidence: capEvidence([
        ...existing.evidence,
        ...update.addEvidence,
      ]),
    });
  }

  dimensions = dimensions.filter(
    (dimension) => !delta.removeDimensionIds.includes(dimension.id),
  );

  for (const constraint of delta.addConstraints) {
    constraints = upsertById(constraints, {
      ...constraint,
      evidence: capEvidence(constraint.evidence, 3),
    });
  }

  for (const update of delta.constraintUpdates) {
    const existing = constraints.find((entry) => entry.id === update.id);
    if (!existing) continue;

    constraints = upsertById(constraints, {
      ...existing,
      ...(update.label !== null ? { label: update.label } : {}),
      ...(update.status !== null ? { status: update.status } : {}),
      ...(update.confidence !== null
        ? { confidence: update.confidence }
        : {}),
      evidence: capEvidence([...existing.evidence, ...update.addEvidence], 3),
    });
  }

  constraints = constraints.filter(
    (constraint) => !delta.removeConstraintIds.includes(constraint.id),
  );

  for (const hypothesis of delta.addHypotheses) {
    hypotheses = upsertById(hypotheses, {
      ...hypothesis,
      evidence: capEvidence(hypothesis.evidence, 3),
    });
  }

  for (const update of delta.hypothesisUpdates) {
    const existing = hypotheses.find((entry) => entry.id === update.id);
    if (!existing) continue;

    hypotheses = upsertById(hypotheses, {
      ...existing,
      ...(update.label !== null ? { label: update.label } : {}),
      ...(update.confidence !== null
        ? { confidence: update.confidence }
        : {}),
      supporting: existing.supporting + update.addSupporting,
      contradicting: existing.contradicting + update.addContradicting,
      evidence: capEvidence([...existing.evidence, ...update.addEvidence], 3),
    });
  }

  hypotheses = hypotheses.filter(
    (hypothesis) => !delta.removeHypothesisIds.includes(hypothesis.id),
  );

  openQuestions = [...openQuestions, ...delta.addOpenQuestions];
  for (const question of delta.removeOpenQuestions) {
    openQuestions = openQuestions.filter((entry) => entry !== question);
  }

  forbiddenCardPatterns = [
    ...forbiddenCardPatterns,
    ...delta.addForbiddenCardPatterns,
  ];
  for (const pattern of delta.removeForbiddenCardPatterns) {
    forbiddenCardPatterns = forbiddenCardPatterns.filter(
      (entry) => entry !== pattern,
    );
  }

  return inferenceStateSchema.parse({
    summary: delta.summary !== null ? delta.summary : current.summary,
    dimensions,
    constraints,
    hypotheses,
    openQuestions: [...new Set(openQuestions)],
    nextFocus:
      delta.setNextFocus.length > 0
        ? delta.setNextFocus.slice(0, MAX_NEXT_FOCUS)
        : current.nextFocus,
    forbiddenCardPatterns: [...new Set(forbiddenCardPatterns)],
    updateCount: current.updateCount + 1,
  });
}
