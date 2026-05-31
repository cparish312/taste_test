import { NextResponse } from "next/server";
import { buildSessionState } from "@/lib/sessionService";
import { startPredictAll } from "@/lib/predictionService";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;
    const result = await startPredictAll(sessionId);
    const session = await buildSessionState(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: result,
      session,
    });
  } catch (error) {
    console.error("POST /api/sessions/[id]/predict-all failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to start predict all";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
