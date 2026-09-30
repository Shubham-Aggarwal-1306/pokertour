import { z } from "zod";

export const GAME_TYPES = ["NLH", "PLO", "PLO5", "Mixed", "Short Deck", "Stud", "Other"] as const;
export const FORMATS = [
  "Freezeout",
  "Re-entry",
  "Rebuy",
  "Bounty",
  "Mystery Bounty",
  "Deepstack",
  "Turbo",
  "Satellite",
  "High Roller",
  "Main Event",
  "Other",
] as const;

export const TournamentSchema = z.object({
  id: z.string(),
  name: z.string(),
  series: z.string().nullable(),
  organizer: z.string().nullable(),
  /** true for online tournaments (then `platform` is set and venue/city may be null) */
  online: z.boolean(),
  platform: z.string().nullable(),
  venue: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  /** ISO 8601 timestamp of the first starting flight */
  startDate: z.string(),
  endDate: z.string().nullable(),
  timezone: z.string().nullable(),
  buyIn: z.number().nullable(),
  currency: z.string().nullable(),
  /** buy-in normalised to USD for filtering and sorting */
  buyInUsd: z.number().nullable(),
  guaranteeUsd: z.number().nullable(),
  game: z.enum(GAME_TYPES),
  formats: z.array(z.enum(FORMATS)),
  startingStack: z.number().nullable(),
  blindLevelMinutes: z.number().nullable(),
  lateRegistration: z.string().nullable(),
  description: z.string().nullable(),
  url: z.string().nullable(),
  /** which ingestion source produced this record ("sample" for bundled demo data) */
  source: z.string(),
  sourceUrl: z.string().nullable(),
  updatedAt: z.string(),
  /** Popularity score; only populated when results are sorted by popularity. */
  popularity: z.number().optional(),
});

export type Tournament = z.infer<typeof TournamentSchema>;

export const SORTS = ["date", "popular", "buyin_asc", "buyin_desc", "guarantee_desc", "relevance"] as const;

/** Shared by the search API, the search page and the AI assistant's search tool. */
export const SearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional().describe("Free-text keywords: name, series, venue, city"),
  country: z.string().trim().max(80).optional().describe("Country name, e.g. 'United States'"),
  city: z.string().trim().max(80).optional().describe("City name, e.g. 'Las Vegas'"),
  online: z.boolean().optional().describe("true = online only, false = live only, omit for both"),
  game: z.enum(GAME_TYPES).optional(),
  format: z.enum(FORMATS).optional(),
  minBuyInUsd: z.number().min(0).optional(),
  maxBuyInUsd: z.number().min(0).optional(),
  minGuaranteeUsd: z.number().min(0).optional(),
  from: z.string().optional().describe("Earliest start date, YYYY-MM-DD. Defaults to today."),
  to: z.string().optional().describe("Latest start date, YYYY-MM-DD"),
  sort: z.enum(SORTS).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).optional(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export interface SearchResult {
  items: Tournament[];
  total: number;
}
