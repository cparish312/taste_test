"use client";

import { useEffect, useRef, useState } from "react";

const EXAMPLE_PROMPTS = [
  "Recommend me a movie I'll actually like",
  "Guess my Myers-Briggs and Big 5",
  "Guess my favorite US politician",
  "Learn my music taste",
  "Tell me what kind of art I like",
  "Figure out what motivates me",
  "Help me choose a startup idea",
];

type TaskInputProps = {
  onStart: (prompt: string) => Promise<void>;
};

export function TaskInput({ onStart }: TaskInputProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const submitDisabled = !mounted || prompt.trim().length === 0 || loading;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      await onStart(prompt.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  function handleExampleClick(example: string) {
    setPrompt(example);
    setError(null);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(example.length, example.length);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6">
      <div className="space-y-3">
        <label htmlFor="task-prompt" className="sr-only">
          What do you want TasteTest to learn?
        </label>
        <textarea
          ref={textareaRef}
          id="task-prompt"
          name="tastetest-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="What do you want TasteTest to learn?"
          rows={3}
          disabled={loading}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          suppressHydrationWarning
          className="w-full resize-none rounded-2xl border border-violet-200 bg-white px-5 py-4 text-lg text-zinc-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:opacity-60"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((example) => {
          const isSelected = prompt === example;
          return (
            <button
              key={example}
              type="button"
              onClick={() => handleExampleClick(example)}
              disabled={loading}
              aria-pressed={isSelected}
              className={`rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
                isSelected
                  ? "border-violet-400 bg-violet-200 text-violet-900"
                  : "border-violet-100 bg-violet-50 text-violet-700 hover:border-violet-200 hover:bg-violet-100"
              }`}
            >
              {example}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        suppressHydrationWarning
        className="w-full rounded-2xl bg-violet-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
      >
        {loading ? "Creating your TasteTest…" : "Start TasteTest"}
      </button>
    </form>
  );
}
