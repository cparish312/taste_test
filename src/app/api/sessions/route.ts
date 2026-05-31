import { NextResponse } from "next/server";
import { createSessionBodySchema } from "@/lib/tasteTestSchemas";
import { createSession } from "@/lib/sessionService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSessionBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const session = await createSession(parsed.data.userPrompt);
    return NextResponse.json(session);
  } catch (error) {
    console.error("POST /api/sessions failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
