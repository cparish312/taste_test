export function createTaskSpecPrompt(userPrompt: string): string {
  return `You are designing a generic adaptive swipe session.

The user will provide a natural language task. Your job is to convert that task into a task spec for a swipe-based preference/inference engine.

IMPORTANT — how swiping works:
- Swipes do NOT answer the user's original question directly.
- Each card shows a stimulus (example, vibe, option, trait, scenario, title, etc.).
- The user swipes to react to THAT CARD ONLY — their taste, interest, familiarity, or fit.
- The system collects many such reactions, then synthesizes the final answer later.
- Example for "recommend me a movie": cards might show specific films, genres, directors, or vibes. Buttons might be "Love it" / "Not for me" / "Haven't seen it" — NOT "Watch it" / "Don't watch" / "Maybe later".

Do not create actual swipe cards yet. Create only the task spec.

Rules:
- Do not assume a hardcoded template.
- Define what positive, negative, and neutral mean as reactions TO CARD CONTENT for this task.
- Default button labels (use unless you have a strong reason to customize):
  - negativeLabel (left): "Disagree"
  - positiveLabel (right): "Agree"
  - neutralLabel (bottom): "Not sure"
- Cards are statements or stimuli the user agrees/disagrees with — not final-answer buttons.
- Labels must describe the user's reaction to the card stimulus, NOT whether they accept the final answer or deliverable.
- Never use labels like "Watch it", "Take this advice", "Left", "Right", "Yes", "No", or similar final-answer / directional placeholders.
- Only customize labels if a task-specific neutral label is clearly better (e.g. "Haven't seen it" for unfamiliar movies). Left/right should stay Disagree/Agree.
- The item strategy must describe what kinds of probe cards/stimuli to show to learn preferences — not cards that deliver the final answer.
- The adaptation strategy should describe how to use swipe reactions to choose better future probe cards.
- The final answer instruction should say to give a direct, minimal answer to the original task after enough swipes.
- For entity tasks (a person, movie, job, song, etc.): the final answer must name specific real-world examples — not a vague archetype, type, or description without names.
- Example final answers: one movie title; 1–3 celebrity names; one job title — not "someone artistic with dark hair."
- Avoid clinical, medical, or overly certain claims.
- Be useful and direct.

User task:
${userPrompt}

Return valid JSON matching the schema.`;
}

export function createInitialInferenceStatePrompt(
  userPrompt: string,
  taskSpecJson: string,
): string {
  return `You are bootstrapping the inference model for a TasteTest adaptive swipe session.

The user task:
${userPrompt}

Task spec:
${taskSpecJson}

Create the initial belief state for what the system needs to learn before it can answer the user's task.

This state drives which probe cards get shown. Cards test dimensions/tradeoffs/constraints — they do NOT present final answers or candidate deliverables.

Rules:
- Define 3–12 dimensions: aspects that matter for answering this task (e.g. for job rec: autonomy, compensation, team size, domain, risk tolerance).
- Identify gating/prerequisite dimensions — things that must be learned early because they dramatically narrow the answer space (e.g. for "guess my celebrity crush": who the user is attracted to / gender preference BEFORE aesthetic fine-tuning).
- Put gating dimensions with confidence "unknown" at the front of nextFocus. They should be probed in the first batch of cards.
- Use stable snake_case ids (e.g. "attraction_gender", "work_life_balance").
- Mark importance "high" for gating dimensions.
- Mark importance and start with confidence "unknown" and signal "unknown" unless obvious from the task alone.
- Add constraints the system should learn (dealbreakers, hard requirements) when relevant.
- Add hypotheses only if useful starting guesses exist; otherwise leave empty.
- openQuestions: what is still unknown and worth probing — list gating questions first.
- nextFocus: 1–3 highest-priority areas to probe first (gating/prerequisite unknowns before refinements).
- forbiddenCardPatterns: card types to avoid (e.g. "presenting the final answer", "naming the user's crush as the deliverable"). Showing real examples as taste probes is OK and often good (e.g. react to a celebrity, a film, a job vibe).
- Do not assume the user has already answered anything.

Return valid JSON matching the schema.`;
}

export function updateInferenceStatePrompt(
  userPrompt: string,
  taskSpecJson: string,
  inferenceStateJson: string,
  newResponsesJson: string,
): string {
  return `You are updating the inference state for a TasteTest adaptive swipe session.

The user task:
${userPrompt}

Task spec:
${taskSpecJson}

Current inference state:
${inferenceStateJson}

New card responses since last update (only these — do not re-process old ones):
${newResponsesJson}

Return ONLY a delta to merge into the current state. Do NOT rewrite or repeat unchanged fields.

For update objects, use null on fields that should not change (e.g. label: null means keep existing label).
Use empty arrays for list fields with no changes.

Rules:
- Update confidence/signal/evidence for dimensions affected by new responses.
- addEvidence: short strings citing what the swipe implied (not the card title verbatim unless helpful).
- You MAY add new dimensions, constraints, or hypotheses if the responses reveal important axes not yet tracked.
- You MAY remove dimensions/constraints/hypotheses that proved irrelevant.
- removeOpenQuestions when answered; addOpenQuestions for newly discovered gaps.
- setNextFocus: replace with 1–3 highest-priority areas to probe next (most informative gaps). Keep unresolved gating/prerequisite dimensions in focus until confidence is at least medium.
- addForbiddenCardPatterns if you notice unhelpful card patterns emerging.
- Keep deltas minimal — only include arrays with actual changes (empty arrays are fine).
- Do not overclaim confidence from a single swipe.
- If a response was neutral, often lower confidence or mark signal as mixed/neutral rather than jumping to strong conclusions.

Return valid JSON matching the delta schema.`;
}

export function generateBatchPrompt(
  userPrompt: string,
  taskSpecJson: string,
  inferenceStateJson: string,
  historyJson: string,
  batchNumber: number,
): string {
  const firstBatchNote =
    batchNumber === 1
      ? `\nThis is BATCH 1 (first cards the user will see). All 5 cards must target gating/prerequisite nextFocus items — the fundamentals that must be learned before anything else. Do not skip to aesthetic or secondary dimensions.\n`
      : "";

  return `You are generating the next batch of cards for TasteTest, a generic adaptive swipe-based data collection system.

Batch number: ${batchNumber}${firstBatchNote}

The user gave this task:
${userPrompt}

Task spec:
${taskSpecJson}

Current inference state (what we know, don't know, and what to probe next):
${inferenceStateJson}

Previous cards and responses:
${historyJson}

Generate exactly 5 new cards.

STANDALONE TITLES (required — most important UX rule):
- The **title alone** must fully state what the user is agreeing or disagreeing with. A user who never sees the image or body must still understand the claim.
- Never use deictic/vague references that require the image: avoid "this look", "this style", "this vibe", "this person", "like this", "guilty?", "would you though?" without naming the subject in the title.
- Bad: "This bold, maximalist look is my vibe" — requires seeing the photo.
- Good: "I'm into bold, maximalist interiors — lots of color, pattern, and clutter."
- Bad: "I'd pick this aesthetic for my dream home" — what aesthetic?
- Good: "Mid-century modern with warm wood and clean lines is my dream-home vibe."
- Bad: "Timothée Chalamet is my type" as title with his photo doing the work — borderline; better: "I'm attracted to soft-featured, artsy guys like Timothée Chalamet."
- body is optional flavor only — never required to understand the claim. Keep it short or minimal.

IMAGE CARDS (optional entertainment — not the probe):
- Images are **extra flair**, not the source of meaning. The title carries 100% of the informational load.
- Use **0–2 image cards per batch** when a fun visual adds energy — never because the card wouldn't make sense without it.
- Most cards should be type "text" with standalone titles.
- type "image": title = complete self-contained claim naming the subject explicitly; imageSearchQuery = a related photo for fun; body = optional witty caption (can be empty or minimal).
- imageSearchQuery must be a concrete searchable subject matching what the title already named (e.g. title mentions "Brutalist architecture" → imageSearchQuery "Brutalist architecture building").
- For type "text", set imageSearchQuery to null.

INFORMATION GAIN (top priority):
- The goal of every card is to learn something useful — not to entertain, confirm what you already believe, or fill space.
- Prioritize cards that would most change the final answer if answered differently. Ask: "If the user disagrees here, would my inference shift?" If no, pick a different card.
- Target nextFocus, openQuestions, and low/unknown-confidence dimensions first. At least 3 of 5 cards must directly probe current nextFocus items.
- Prefer probes that discriminate between competing hypotheses — cards that split plausible outcomes, not ones where any answer is unsurprising.
- Skip or defer dimensions already at high confidence unless you need a falsification check (one validating + one challenging card is enough).
- Do not repeat or lightly rephrase prior cards. If history already tested a dimension, go deeper, test an adjacent tradeoff, or move to the next gap.
- hiddenPurpose must state what uncertainty this card reduces and which hypothesis it tests or rules out.
- In strategySummary, name the main uncertainties this batch targets and what you expect to learn from each card.

WITHIN-BATCH DIVERSITY (in service of information gain):
- All 5 cards should test different angles, dimensions, or stimuli — redundant probes waste swipes.
- Prefer at most 1 card per targetDimensionId unless a gating dimension truly requires multiple probes in batch 1.
- Mix card shapes when it helps discriminate: trait statements, named examples in the title, tradeoffs, boundary tests — choose the shape that best splits uncertainty.
- If history is repetitive, pivot to an under-probed dimension rather than another similar card.

EXPECTED RESPONSE MIX (supports information gain):
- Do NOT optimize for cards the user will agree with. A good batch needs disconfirming and boundary probes, not only flattering or on-brand stimuli.
- Aim for this distribution across the 5 cards:
  - ~2 cards you expect the user to Agree with (positive) — confirm strong signals from inference state/history.
  - ~2 cards you expect the user to Disagree with (negative) — test anti-patterns, opposites, dealbreakers, or traits they have rejected.
  - ~1 card that is genuinely uncertain (could go Agree, Disagree, or Not sure) — highest information value when confidence is low.
- Use inference state confidence deliberately:
  - High-confidence dimensions → include BOTH a validating card (likely agree) AND a challenging contrast (likely disagree) when possible.
  - Unknown/low-confidence dimensions → include cards where you are not sure of the response; do not assume agreement.
- Construct disagree-likely cards honestly: pick stimuli that conflict with established positive signals or match established negative signals — not strawmen.
- In strategySummary, briefly note the intended agree/disagree/uncertain mix for this batch.

TONE & VOICE (character + clarity — both required):
- Every card needs a clear, **standalone** claim AND a bit of personality. Sound like a sharp friend, not a survey.
- title = the full agree/disagree statement with character — vivid, direct, self-contained. Put names, styles, and specifics IN the title.
- body = optional spice only; the title must never depend on it.
- Aim for 2–3 cards per batch with noticeable character; the rest can be straighter but still casual.
- Personality must never obscure or replace the claim. If the title isn't understandable alone, rewrite it.

CARD TYPES:
- type "text": default — standalone title + optional body. Use for most cards.

CRITICAL — cards are preference probes, NOT the final answer:
- If a gating/prerequisite dimension is still unknown (importance high, confidence unknown/low), prioritize it — especially in early batches.
- Each card should test a dimension, tradeoff, constraint, vibe, or concrete example — NOT deliver the final guess.
- Concrete named examples in the **title** are encouraged when they test a dimension (e.g. a specific celebrity, film genre, political figure, or style — spelled out in the title). Forbidden: presenting someone/something AS the session's final answer.
- For "guess my celebrity crush": early cards must clarify who the user is attracted to (e.g. men, women, both, neither) before aesthetic refinement. Use taste probes — celebrity examples, vibe cards, tradeoffs — not "your crush is X."
- For "recommend my new job": test autonomy, compensation vs mission, team size, etc. Do NOT present the final job pick.
- For "recommend me a movie": test genres, tones, directors, tropes — do NOT present the final movie pick.
- Button labels react to THIS CARD. Default to Disagree (left), Agree (right), Not sure (bottom).
- Only customize neutralLabel when task-specific wording helps (e.g. "Don't know them", "Haven't seen it"). Left is always Disagree, right is always Agree.
- Phrase cards as clear agree/disagree statements with vivid, casual wording — explicit claim, but not bland (e.g. "Slow, artsy films are worth the runtime" not "I enjoy art house cinema").
- Respect forbiddenCardPatterns in the inference state.

Rules:
- Do not repeat previous cards.
- Do not ask direct explanation questions.
- Do not ask the user to type anything.
- Do not present any card as the final answer or deliverable.
- Each card should reduce uncertainty on a tracked dimension or open question — if it wouldn't update inference state, replace it.
- Set targetDimensionId to the dimension id this card primarily tests, or null if none applies.
- targetDimensionId must always be present on every item (use null when not applicable).
- type must always be present: "text" or "image".
- imageSearchQuery must always be present: null for text cards, a concrete search query for image cards.
- hiddenPurpose must name which dimension/question/hypothesis the card tests.
- SWIPE LABELS (required on every item — use null to accept defaults):
  - negativeLabel: default "Disagree" (left). Set null to use default.
  - positiveLabel: default "Agree" (right). Set null to use default.
  - neutralLabel: default "Not sure" (bottom). Set null to use default, or provide a better task-specific neutral when needed.
- Never use Left, Right, Yes, No, Positive, Negative, or other placeholders.
- Keep cards concise, readable, and alive — boring cards waste swipes even if technically clear.

Return valid JSON:
{
  "strategySummary": "what uncertainties this batch targets, expected agree/disagree mix, and what each card should learn",
  "items": [
    {
      "type": "image",
      "title": "I'm into bold, maximalist interiors — lots of color, pattern, and clutter",
      "body": "More is more.",
      "positiveLabel": null,
      "negativeLabel": null,
      "neutralLabel": null,
      "hiddenPurpose": "...",
      "targetDimensionId": "dimension_id_or_null",
      "imageSearchQuery": "maximalist living room interior"
    }
  ]
}`;
}

export function finalizeSessionPrompt(
  userPrompt: string,
  taskSpecJson: string,
  inferenceStateJson: string,
  fullHistoryJson: string,
): string {
  return `You are producing the final answer for a TasteTest adaptive swipe session.

The user's original task:
${userPrompt}

Task spec:
${taskSpecJson}

Inference state (structured summary of what was learned):
${inferenceStateJson}

Cards shown and user responses:
${fullHistoryJson}

Synthesize the inference state and swipe evidence into the final answer.

Rules:
- Give the direct deliverable the user asked for. Do not recap the swiping process.
- Name specific real-world entities when the task implies a person, place, title, or thing:
  - Celebrity crush / who you'd like → 1 primary name, or top 3 ranked names (real celebrities with full names). Never only a vague type like "someone artistic with dark hair."
  - Movie/music/food rec → specific title(s)
  - Job rec → specific role/type or example
- Lead with the name(s) or title(s) in the first line. Then 1–2 sentences per pick on why they fit.
- For pure personality/taste inference with no entity requested: give a clear direct inference with brief caveats.
- Use inference state as primary evidence; swipe history supports it.
- Do not list every card or dimension in the answer.
- Do not overclaim.
- Do not mention implementation details, cards, swipes, or inference state unless the user asked.

Return valid JSON:
{
  "answer": "main final answer as markdown",
  "confidence": "low" | "medium" | "high",
  "summary": "short summary of what was inferred",
  "notablePatterns": ["pattern 1", "pattern 2", "pattern 3"],
  "suggestedNextTests": ["optional next swipe task 1", "optional next swipe task 2"]
}`;
}

export function predictResponsePrompt(
  userPrompt: string,
  taskSpecJson: string,
  historyJson: string,
  currentCardJson: string,
): string {
  return `You predict how a user will swipe on the next TasteTest card based on their prior responses.

The user's task:
${userPrompt}

Task spec:
${taskSpecJson}

Previous cards and responses (positive = Agree/right, negative = Disagree/left, neutral = Not sure/down):
${historyJson}

Current card to predict (user has NOT answered this yet):
${currentCardJson}

Predict the user's most likely response: positive, negative, or neutral.

Rules:
- Use patterns from prior responses (consistent agrees/disagrees, neutral habits, taste signals).
- Consider what the current card is testing and how similar past cards were answered.
- Output only the prediction enum value.
- Do not explain your reasoning in the output.

Return valid JSON:
{ "prediction": "positive" | "negative" | "neutral" }`;
}
