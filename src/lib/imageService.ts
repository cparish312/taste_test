import type { BatchOutput } from "./tasteTestSchemas";

type RawBatchItem = {
  type: "text" | "image";
  title: string;
  body: string;
  positiveLabel: string;
  negativeLabel: string;
  neutralLabel: string;
  hiddenPurpose: string;
  imageSearchQuery?: string | null;
  metadata?: Record<string, unknown>;
};

type EnrichedItem = BatchOutput["items"][number] & {
  type: "text" | "image";
  imageUrl: string | null;
};

async function searchWikipediaImage(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    prop: "pageimages",
    format: "json",
    piprop: "thumbnail",
    pithumbsize: "800",
    origin: "*",
  });

  try {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?${params.toString()}`,
      { next: { revalidate: 86400 } },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          { thumbnail?: { source?: string }; title?: string }
        >;
      };
    };

    const pages = data.query?.pages;
    if (!pages) return null;

    for (const page of Object.values(pages)) {
      const source = page.thumbnail?.source;
      if (source) return source;
    }
  } catch (error) {
    console.error(`Wikipedia image search failed for "${query}":`, error);
  }

  return null;
}

async function searchUnsplashImage(query: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const params = new URLSearchParams({
      query,
      per_page: "1",
      orientation: "portrait",
    });

    const response = await fetch(
      `https://api.unsplash.com/search/photos?${params.toString()}`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        next: { revalidate: 86400 },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      results?: Array<{ urls?: { regular?: string } }>;
    };

    return data.results?.[0]?.urls?.regular ?? null;
  } catch (error) {
    console.error(`Unsplash image search failed for "${query}":`, error);
  }

  return null;
}

export async function resolveImageUrl(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const wiki = await searchWikipediaImage(trimmed);
  if (wiki) return wiki;

  const unsplash = await searchUnsplashImage(trimmed);
  if (unsplash) return unsplash;

  return null;
}

function ensureAtLeastOneImageCandidate(items: RawBatchItem[]): RawBatchItem[] {
  if (items.some((item) => item.type === "image" && item.imageSearchQuery)) {
    return items;
  }

  const next = [...items];
  const candidateIndex = next.findIndex(
    (item) => item.title.trim().length > 0 && item.body.trim().length > 0,
  );
  const index = candidateIndex === -1 ? 0 : candidateIndex;
  const candidate = next[index];

  next[index] = {
    ...candidate,
    type: "image",
    imageSearchQuery: candidate.title,
  };

  return next;
}

export async function enrichBatchItemsWithImages(
  items: RawBatchItem[],
): Promise<EnrichedItem[]> {
  const withCandidates = ensureAtLeastOneImageCandidate(items);

  const enriched = await Promise.all(
    withCandidates.map(async (item) => {
      const metadata = item.metadata ?? {};
      const base = {
        title: item.title,
        body: item.body,
        positiveLabel: item.positiveLabel,
        negativeLabel: item.negativeLabel,
        neutralLabel: item.neutralLabel,
        hiddenPurpose: item.hiddenPurpose,
        metadata,
      };

      if (item.type !== "image" || !item.imageSearchQuery?.trim()) {
        return { ...base, type: "text" as const, imageUrl: null };
      }

      const imageUrl = await resolveImageUrl(item.imageSearchQuery);
      if (!imageUrl) {
        return { ...base, type: "text" as const, imageUrl: null };
      }

      return {
        ...base,
        type: "image" as const,
        imageUrl,
        metadata: {
          ...metadata,
          imageSearchQuery: item.imageSearchQuery,
        },
      };
    }),
  );

  if (enriched.some((item) => item.type === "image" && item.imageUrl)) {
    return enriched;
  }

  for (let index = 0; index < enriched.length; index++) {
    const item = enriched[index];
    const queries = [
      item.title,
      `${item.title} ${item.body}`.slice(0, 80),
      item.body.slice(0, 60),
    ];

    for (const query of queries) {
      const imageUrl = await resolveImageUrl(query);
      if (imageUrl) {
        enriched[index] = {
          ...item,
          type: "image",
          imageUrl,
          metadata: {
            ...(item.metadata as Record<string, unknown>),
            imageSearchQuery: query,
          },
        };
        return enriched;
      }
    }
  }

  return enriched;
}
