import { createHash } from "node:crypto";
import { indexTournaments } from "@/lib/rag";
import { getStore } from "@/lib/store";
import { extractWithAi } from "./ai-extract";
import { extractJsonLd } from "./jsonld";
import { finalize } from "./normalize";
import { loadSources, type Source } from "./sources";

export interface SourceReport {
  source: string;
  status: "ok" | "unchanged" | "error";
  method?: "jsonld" | "ai" | "none";
  found?: number;
  /** Records whose embedding was (re)computed. */
  embedded?: number;
  error?: string;
}

const USER_AGENT = "PokerTourBot/0.1 (+https://github.com/shubham-aggarwal-1306/pokertour)";

async function ingestSource(source: Source, force: boolean): Promise<SourceReport> {
  const store = getStore();
  const res = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Skip pages that haven't changed since last run: no parsing, no AI tokens.
  const hash = createHash("sha256").update(html).digest("hex");
  if (!force && (await store.getSourceHash(source.url)) === hash) {
    return { source: source.id, status: "unchanged" };
  }

  let method: SourceReport["method"] = "jsonld";
  let drafts = extractJsonLd(html, source.pokerOnly);
  if (drafts.length === 0 && source.ai && process.env.ANTHROPIC_API_KEY) {
    method = "ai";
    drafts = await extractWithAi(html, source.url);
  }
  if (drafts.length === 0) method = "none";

  const tournaments = drafts
    .map((d) => finalize(d, source.id, source.url))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  await store.upsert(tournaments);
  const embedded = await indexTournaments(tournaments);
  await store.setSourceHash(source.url, hash);
  return { source: source.id, status: "ok", method, found: tournaments.length, embedded };
}

export async function runIngest({ force = false } = {}): Promise<SourceReport[]> {
  const reports: SourceReport[] = [];
  for (const source of loadSources()) {
    try {
      reports.push(await ingestSource(source, force));
    } catch (err) {
      reports.push({ source: source.id, status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return reports;
}
