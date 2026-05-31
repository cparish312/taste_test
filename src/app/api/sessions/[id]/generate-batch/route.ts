import { NextResponse } from "next/server";
import { generateNextBatch, retryFailedBatch } from "@/lib/generationService";
import { buildSessionState } from "@/lib/sessionService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const retry = Boolean(body?.retry);

    if (retry) {
      await retryFailedBatch(id);
    } else {
      await generateNextBatch(id);
    }

    const session = await buildSessionState(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("POST /api/sessions/[id]/generate-batch failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate batch";

    const { id } = await context.params;
    const session = await buildSessionState(id);

    return NextResponse.json(
      { error: message, session },
      { status: 500 },
    );
  }
}
