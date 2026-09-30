import type { SearchQuery, SearchResult, Tournament } from "@/lib/types";

export interface SearchOptions {
  /** Restrict results to these ids (used to apply structured filters to vector-search hits). */
  ids?: string[];
}

export interface TournamentStore {
  search(query: SearchQuery, options?: SearchOptions): Promise<SearchResult>;
  get(id: string): Promise<Tournament | null>;
  /** Insert or update by id. Returns the number of rows written. */
  upsert(tournaments: Tournament[]): Promise<number>;
  /** Content hash of a source page from the last ingest, used to skip unchanged pages. */
  getSourceHash(sourceUrl: string): Promise<string | null>;
  setSourceHash(sourceUrl: string, hash: string): Promise<void>;
}

export const DEFAULT_LIMIT = 20;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
