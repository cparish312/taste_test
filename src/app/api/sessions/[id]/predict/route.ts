import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePrediction } from "@/lib/predictionService";
import { z } from "zod";

const bodySchema = z.object({
  itemId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "active") {
      return NextResponse.json(
        { error: "Session is not active" },
        { status: 400 },
      );
    }

    const prediction = await ensurePrediction(sessionId, parsed.data.itemId);

    return NextResponse.json({
      prediction,
      enabled: prediction !== null,
    });
  } catch (error) {
    console.error("POST /api/sessions/[id]/predict failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to predict response";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
