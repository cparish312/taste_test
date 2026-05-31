import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { FinalAnswer } from "@/lib/tasteTestSchemas";

type ResultViewProps = {
  userPrompt: string;
  finalData: FinalAnswer;
};

const confidenceStyles = {
  low: "bg-amber-100 text-amber-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-emerald-100 text-emerald-800",
} as const;

export function ResultView({ userPrompt, finalData }: ResultViewProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-500">
          Your TasteTest
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          Results
        </h1>
        <p className="text-zinc-600">Task: {userPrompt}</p>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${confidenceStyles[finalData.confidence]}`}
        >
          {finalData.confidence} confidence
        </span>
      </div>

      <section className="rounded-3xl border border-violet-100 bg-white p-8 shadow-lg">
        <div className="prose prose-zinc max-w-none prose-headings:font-bold prose-p:leading-relaxed">
          <ReactMarkdown>{finalData.answer}</ReactMarkdown>
        </div>
      </section>

      <section className="rounded-2xl bg-violet-50 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Summary</h2>
        <p className="mt-2 text-zinc-700">{finalData.summary}</p>
      </section>

      {finalData.notablePatterns.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">
            Notable patterns
          </h2>
          <ul className="space-y-2">
            {finalData.notablePatterns.map((pattern) => (
              <li
                key={pattern}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-700"
              >
                {pattern}
              </li>
            ))}
          </ul>
        </section>
      )}

      {finalData.suggestedNextTests.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">
            Try next
          </h2>
          <ul className="space-y-2">
            {finalData.suggestedNextTests.map((test) => (
              <li
                key={test}
                className="rounded-xl border border-dashed border-violet-200 px-4 py-3 text-violet-700"
              >
                {test}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/"
        className="inline-flex rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-700"
      >
        Start another TasteTest
      </Link>
    </div>
  );
}
