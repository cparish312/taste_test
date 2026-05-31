import { NextResponse } from "next/server";
import { finalizeSessionById } from "@/lib/sessionService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await finalizeSessionById(id);
    return NextResponse.json(session);
  } catch (error) {
    console.error("POST /api/sessions/[id]/finalize failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to finalize session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
