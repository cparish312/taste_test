import type { SessionItem } from "@/lib/tasteTestSchemas";

type SwipeCardProps = {
  item: SessionItem;
};

export function SwipeCard({ item }: SwipeCardProps) {
  const isImageCard = item.type === "image" && item.imageUrl;

  return (
    <article className="w-full max-w-2xl overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-100/60">
      <div className="p-6 pb-4 sm:p-8 sm:pb-5">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-500">
          TasteTest
        </p>
        <h2 className="text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl">
          {item.title}
        </h2>
      </div>

      {isImageCard ? (
        <div className="px-4 pb-4 sm:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl!}
            alt={item.title}
            className="mx-auto max-h-[min(52vh,420px)] w-full rounded-2xl object-cover object-center"
            loading="eager"
          />
        </div>
      ) : null}

      {item.body.trim() && (
        <p
          className={`px-6 text-lg leading-relaxed text-zinc-600 sm:px-8 sm:text-xl ${
            isImageCard ? "pb-6 pt-3" : "pb-8 pt-2"
          }`}
        >
          {item.body}
        </p>
      )}

      {!item.body.trim() && isImageCard && <div className="pb-6" />}
    </article>
  );
}
