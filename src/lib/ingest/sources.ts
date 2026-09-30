import { z } from "zod";

export const SourceSchema = z.object({
  /** Short stable id, used as the prefix of tournament ids. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  url: z.string().url(),
  /** The page lists only poker events, so skip the poker keyword filter. */
  pokerOnly: z.boolean().default(true),
  /** Fall back to AI extraction when the page has no JSON-LD events (costs tokens). */
  ai: z.boolean().default(false),
});

export type Source = z.infer<typeof SourceSchema>;

/**
 * Sources are configured with the INGEST_SOURCES env var (JSON array), e.g.
 * [{"id":"my-casino","url":"https://example.com/poker/schedule","ai":true}]
 *
 * Only add sites whose terms allow it, and respect robots.txt.
 */
export function loadSources(): Source[] {
  const raw = process.env.INGEST_SOURCES;
  if (!raw) return [];
  return z.array(SourceSchema).parse(JSON.parse(raw));
}
