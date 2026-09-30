import { semanticSearch } from "@/lib/rag";
import { getStore } from "@/lib/store";
import { DEFAULT_LIMIT } from "@/lib/store/types";
import type { SearchQuery, SearchResult, Tournament } from "@/lib/types";

const CANDIDATES = 50;
const RRF_K = 60;

/**
 * Hybrid retrieval used by the search page, the API and the AI assistant:
 *  - structured filters (dates, buy-in, location, game…) always apply exactly;
 *  - free text is matched both by keyword search and by vector similarity
 *    (RAG over tournament embeddings), and the two rankings are merged with
 *    reciprocal rank fusion.
 * Without free text it is a plain filtered listing.
 */
export async function searchTournaments(query: SearchQuery): Promise<SearchResult> {
  const store = getStore();
  const q = query.q?.trim();
  if (!q) return store.search(query);

  const { q: _q, limit = DEFAULT_LIMIT, offset = 0, ...filters } = query;
  const [keyword, semantic] = await Promise.all([
    store.search({ ...query, limit: CANDIDATES, offset: 0 }),
    semanticSearch(q, CANDIDATES).catch((err) => {
      console.error("semantic search failed, falling back to keyword only", err);
      return [];
    }),
  ]);

  // Apply the structured filters to the vector hits.
  const semanticHits = semantic.length
    ? (await store.search({ ...filters, limit: CANDIDATES, offset: 0 }, { ids: semantic.map((s) => s.id) })).items
    : [];
  const semanticRank = new Map(semantic.map((s, i) => [s.id, i]));
  semanticHits.sort((a, b) => semanticRank.get(a.id)! - semanticRank.get(b.id)!);

  const fused = new Map<string, { t: Tournament; score: number }>();
  const addRanking = (list: Tournament[]) =>
    list.forEach((t, rank) => {
      const entry = fused.get(t.id) ?? { t, score: 0 };
      entry.score += 1 / (RRF_K + rank);
      fused.set(t.id, entry);
    });
  addRanking(keyword.items);
  addRanking(semanticHits);

  let merged = [...fused.values()].sort((a, b) => b.score - a.score).map((e) => e.t);
  const sort = query.sort ?? "relevance";
  if (sort !== "relevance") merged = sortBy(merged, sort);

  return { items: merged.slice(offset, offset + limit), total: merged.length };
}

function sortBy(items: Tournament[], sort: NonNullable<SearchQuery["sort"]>): Tournament[] {
  const byDate = (a: Tournament, b: Tournament) => a.startDate.localeCompare(b.startDate);
  const cmp: Record<string, (a: Tournament, b: Tournament) => number> = {
    date: byDate,
    buyin_asc: (a, b) => (a.buyInUsd ?? Infinity) - (b.buyInUsd ?? Infinity) || byDate(a, b),
    buyin_desc: (a, b) => (b.buyInUsd ?? -1) - (a.buyInUsd ?? -1) || byDate(a, b),
    guarantee_desc: (a, b) => (b.guaranteeUsd ?? -1) - (a.guaranteeUsd ?? -1) || byDate(a, b),
  };
  return cmp[sort] ? [...items].sort(cmp[sort]) : items;
}
