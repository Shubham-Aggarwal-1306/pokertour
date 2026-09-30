import { buildSampleTournaments } from "@/lib/data/sample";
import type { SearchQuery, SearchResult, Tournament } from "@/lib/types";
import { DEFAULT_LIMIT, todayIso, type SearchOptions, type TournamentStore } from "./types";

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function textScore(t: Tournament, terms: string[]): number {
  if (terms.length === 0) return 1;
  const fields: [string, number][] = [
    [norm(t.name), 3],
    [norm(t.series), 2],
    [norm(t.organizer), 1],
    [norm(t.venue), 1],
    [norm(t.city), 2],
    [norm(t.country), 1],
    [norm(t.platform), 2],
    [norm(t.game), 1],
    [norm(t.formats.join(" ")), 1],
    [norm(t.description), 0.5],
  ];
  let score = 0;
  for (const term of terms) {
    const hit = fields.reduce((s, [text, w]) => (text.includes(term) ? s + w : s), 0);
    if (hit === 0) return 0; // every term must match somewhere
    score += hit;
  }
  return score;
}

/** Filtering, scoring and sorting shared by the in-memory store and tests. */
export function searchInMemory(all: Tournament[], query: SearchQuery, options: SearchOptions = {}): SearchResult {
  const ids = options.ids ? new Set(options.ids) : null;
  const terms = norm(query.q).split(/\s+/).filter(Boolean);
  const from = query.from ?? todayIso();
  const scored: { t: Tournament; score: number }[] = [];

  for (const t of all) {
    if (ids && !ids.has(t.id)) continue;
    const lastDay = (t.endDate ?? t.startDate).slice(0, 10);
    if (lastDay < from) continue;
    if (query.to && t.startDate.slice(0, 10) > query.to) continue;
    if (query.online !== undefined && t.online !== query.online) continue;
    if (query.country && norm(t.country) !== norm(query.country)) continue;
    if (query.city && norm(t.city) !== norm(query.city)) continue;
    if (query.game && t.game !== query.game) continue;
    if (query.format && !t.formats.includes(query.format)) continue;
    if (query.minBuyInUsd !== undefined && (t.buyInUsd ?? -1) < query.minBuyInUsd) continue;
    if (query.maxBuyInUsd !== undefined && (t.buyInUsd ?? Infinity) > query.maxBuyInUsd) continue;
    if (query.minGuaranteeUsd !== undefined && (t.guaranteeUsd ?? -1) < query.minGuaranteeUsd) continue;
    const score = textScore(t, terms);
    if (score > 0) scored.push({ t, score });
  }

  const sort = query.sort ?? (terms.length ? "relevance" : "date");
  const byDate = (a: Tournament, b: Tournament) => a.startDate.localeCompare(b.startDate);
  scored.sort((a, b) => {
    switch (sort) {
      case "buyin_asc":
        return (a.t.buyInUsd ?? Infinity) - (b.t.buyInUsd ?? Infinity) || byDate(a.t, b.t);
      case "buyin_desc":
        return (b.t.buyInUsd ?? -1) - (a.t.buyInUsd ?? -1) || byDate(a.t, b.t);
      case "guarantee_desc":
        return (b.t.guaranteeUsd ?? -1) - (a.t.guaranteeUsd ?? -1) || byDate(a.t, b.t);
      case "relevance":
        return b.score - a.score || byDate(a.t, b.t);
      default:
        return byDate(a.t, b.t);
    }
  });

  const offset = query.offset ?? 0;
  const limit = query.limit ?? DEFAULT_LIMIT;
  return { items: scored.slice(offset, offset + limit).map((s) => s.t), total: scored.length };
}

/** Used when DATABASE_URL is not set: serves the bundled sample data. Writes live only for the process lifetime. */
export class MemoryStore implements TournamentStore {
  private rows = new Map<string, Tournament>();
  private hashes = new Map<string, string>();

  constructor(seed: Tournament[] = buildSampleTournaments()) {
    for (const t of seed) this.rows.set(t.id, t);
  }

  async search(query: SearchQuery, options?: SearchOptions) {
    return searchInMemory([...this.rows.values()], query, options);
  }

  async get(id: string) {
    return this.rows.get(id) ?? null;
  }

  async upsert(tournaments: Tournament[]) {
    for (const t of tournaments) this.rows.set(t.id, t);
    return tournaments.length;
  }

  async getSourceHash(url: string) {
    return this.hashes.get(url) ?? null;
  }

  async setSourceHash(url: string, hash: string) {
    this.hashes.set(url, hash);
  }
}
