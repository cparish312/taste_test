import { NextResponse } from "next/server";
import { buildSessionState } from "@/lib/sessionService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await buildSessionState(id);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("GET /api/sessions/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to load session" },
      { status: 500 },
    );
  }
}
