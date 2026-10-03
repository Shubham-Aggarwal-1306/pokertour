import { Document } from "@langchain/core/documents";
import { formatMoney } from "@/lib/currency";
import { getDatabaseUrl } from "@/lib/db-url";
import { getStore } from "@/lib/store";
import type { Tournament } from "@/lib/types";
import { getEmbeddings } from "./embeddings";
import { InMemoryVectorStore, NeonVectorStore } from "./vectorstores";

type TournamentVectorStore = InMemoryVectorStore | NeonVectorStore;

/**
 * The text that gets embedded. Written as natural prose so queries like
 * "cheap deepstack in Vegas" or "big guarantee Omaha event in Europe" land near
 * the right records.
 */
export function tournamentToText(t: Tournament): string {
  const where = t.online
    ? `Online poker tournament on ${t.platform ?? "an online site"}.`
    : `Live poker tournament at ${[t.venue, t.city, t.country].filter(Boolean).join(", ")}.`;
  const buyIn = t.buyIn != null ? `Buy-in ${formatMoney(t.buyIn, t.currency)}${t.buyInUsd ? ` (about $${Math.round(t.buyInUsd)})` : ""}.` : "";
  const gtd = t.guaranteeUsd ? `Guarantee $${t.guaranteeUsd.toLocaleString("en-US")}.` : "";
  return [
    t.name,
    t.series ? `Part of ${t.series}.` : "",
    t.organizer ? `Organized by ${t.organizer}.` : "",
    where,
    `Game: ${t.game}. Format: ${t.formats.join(", ") || "standard"}.`,
    buyIn,
    gtd,
    t.startingStack ? `Starting stack ${t.startingStack}.` : "",
    t.blindLevelMinutes ? `${t.blindLevelMinutes}-minute levels.` : "",
    t.description ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

let vectorStore: Promise<TournamentVectorStore> | undefined;

export function getVectorStore(): Promise<TournamentVectorStore> {
  vectorStore ??= (async () => {
    const embeddings = getEmbeddings();
    const url = getDatabaseUrl();
    if (url) {
      return new NeonVectorStore(embeddings, { connectionString: url, model: embeddings.modelName });
    }
    // Demo mode: embed the in-memory sample data on first use.
    const store = new InMemoryVectorStore(embeddings);
    const { items } = await getStore().search({ from: "1970-01-01", limit: 100_000 });
    await addTournaments(store, items);
    return store;
  })();
  return vectorStore;
}

async function addTournaments(store: TournamentVectorStore, tournaments: Tournament[]): Promise<number> {
  const docs = tournaments.map(
    (t) => new Document({ id: t.id, pageContent: tournamentToText(t), metadata: { id: t.id } }),
  );
  // Only embed records whose text changed: embeddings cost money with Voyage.
  const existing = await store.existingContent(docs.map((d) => d.id!));
  const changed = docs.filter((d) => existing.get(d.id!) !== d.pageContent);
  if (changed.length) await store.addDocuments(changed, { ids: changed.map((d) => d.id!) });
  return changed.length;
}

/** Embed new/changed tournaments into the vector store. Returns how many were embedded. */
export async function indexTournaments(tournaments: Tournament[]): Promise<number> {
  return addTournaments(await getVectorStore(), tournaments);
}

// Small LRU of query embeddings: repeated searches ("vegas", "plo") cost nothing.
const queryCache = new Map<string, number[]>();
async function embedQueryCached(q: string): Promise<number[]> {
  const key = q.trim().toLowerCase();
  const hit = queryCache.get(key);
  if (hit) {
    queryCache.delete(key);
    queryCache.set(key, hit);
    return hit;
  }
  const vector = await getEmbeddings().embedQuery(key);
  queryCache.set(key, vector);
  if (queryCache.size > 500) queryCache.delete(queryCache.keys().next().value!);
  return vector;
}

/** Semantic retrieval: ids of the closest tournaments with cosine similarity scores. */
export async function semanticSearch(q: string, k = 50): Promise<{ id: string; score: number }[]> {
  const store = await getVectorStore();
  const results = await store.similaritySearchVectorWithScore(await embedQueryCached(q), k);
  const minScore = process.env.RAG_MIN_SCORE ? Number(process.env.RAG_MIN_SCORE) : getEmbeddings().defaultMinScore;
  return results.filter(([, score]) => score >= minScore).map(([doc, score]) => ({ id: doc.id ?? doc.metadata.id, score }));
}
