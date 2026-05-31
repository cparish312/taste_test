"use client";

import { useRouter } from "next/navigation";
import { TaskInput } from "@/components/TaskInput";
import type { SessionState } from "@/lib/tasteTestSchemas";

export default function HomePage() {
  const router = useRouter();

  async function handleStart(prompt: string) {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrompt: prompt }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to create session");
    }

    const session = data as SessionState;
    router.push(`/sessions/${session.id}`);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-gradient-to-b from-violet-50 via-white to-white px-4 py-16">
      <main className="flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-10 space-y-4">
          <h1 className="text-5xl font-black tracking-tight text-zinc-900 sm:text-6xl">
            TasteTest
          </h1>
          <p className="mx-auto max-w-xl text-lg text-zinc-600 sm:text-xl">
            Swipe your way to better recommendations, predictions, and
            self-understanding.
          </p>
        </div>

        <TaskInput onStart={handleStart} />
      </main>
    </div>
  );
}
