import { NextResponse } from "next/server";
import { createResponseBodySchema } from "@/lib/tasteTestSchemas";
import { saveResponse } from "@/lib/sessionService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createResponseBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const session = await saveResponse(parsed.data);
    return NextResponse.json(session);
  } catch (error) {
    console.error("POST /api/responses failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save response";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
