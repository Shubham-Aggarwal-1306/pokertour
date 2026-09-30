import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";

/** Must match the `vector(N)` column in db/schema.sql. */
export const EMBEDDING_DIMENSIONS = 512;

/**
 * Voyage AI embeddings (Anthropic's recommended embeddings provider).
 * voyage-3.5-lite is the cheapest model and plenty for short tournament records;
 * 512 dimensions keeps pgvector storage and distance math small.
 */
export class VoyageEmbeddings extends Embeddings {
  readonly modelName: string;
  /** Cosine similarity below which a hit is treated as unrelated. */
  readonly defaultMinScore = 0.3;
  private apiKey: string;

  constructor(fields: EmbeddingsParams & { apiKey: string; model?: string }) {
    super(fields);
    this.apiKey = fields.apiKey;
    this.modelName = fields.model ?? "voyage-3.5-lite";
  }

  private async embed(input: string[], inputType: "document" | "query"): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < input.length; i += 128) {
      const batch = input.slice(i, i + 128);
      const res = await this.caller.call(async () => {
        const r = await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            input: batch,
            model: this.modelName,
            input_type: inputType,
            output_dimension: EMBEDDING_DIMENSIONS,
          }),
        });
        if (!r.ok) throw new Error(`Voyage embeddings failed: HTTP ${r.status} ${await r.text()}`);
        return (await r.json()) as { data: { embedding: number[]; index: number }[] };
      });
      out.push(...res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
    }
    return out;
  }

  embedDocuments(documents: string[]) {
    return this.embed(documents, "document");
  }

  async embedQuery(query: string) {
    return (await this.embed([query], "query"))[0];
  }
}

/**
 * Zero-cost fallback used when VOYAGE_API_KEY is not set: feature-hashes word
 * unigrams, bigrams and character trigrams into a fixed-size vector. It captures
 * lexical similarity and typos (not true semantics), which keeps local dev and
 * the demo working without any API spend.
 */
export class HashingEmbeddings extends Embeddings {
  readonly modelName = "hashing-v1";
  readonly defaultMinScore = 0.12;

  constructor(fields: EmbeddingsParams = {}) {
    super(fields);
  }

  private static hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Words that appear in almost every record/query and would drown the signal.
  private static STOP = new Set(
    "a an and at by for from in is of on or the to with any some me find show poker tournament tournaments event events game games play series part organized about".split(" "),
  );
  // Tiny domain thesaurus so common poker phrasings meet the stored wording.
  private static SYNONYMS: Record<string, string> = {
    omaha: "plo", plo: "omaha", holdem: "nlh", nlh: "holdem", nlhe: "nlh", pko: "bounty",
    knockout: "bounty", brasil: "brazil", usa: "united states", us: "united states", uk: "united kingdom",
    vegas: "las vegas", cheap: "low buy-in", gtd: "guarantee", guaranteed: "guarantee",
  };

  static vector(text: string): number[] {
    const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    const words = text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9$]+/)
      .filter((w) => w && !HashingEmbeddings.STOP.has(w))
      .flatMap((w) => (HashingEmbeddings.SYNONYMS[w] ? [w, ...HashingEmbeddings.SYNONYMS[w].split(" ")] : [w]));
    const add = (feature: string, weight: number) => {
      const h = HashingEmbeddings.hash(feature);
      v[h % EMBEDDING_DIMENSIONS] += h & 0x80000000 ? -weight : weight;
    };
    words.forEach((w, i) => {
      add(`w:${w}`, 1);
      if (i > 0) add(`b:${words[i - 1]} ${w}`, 0.7);
      const padded = ` ${w} `;
      for (let j = 0; j < padded.length - 2; j++) add(`c:${padded.slice(j, j + 3)}`, 0.15);
    });
    const norm = Math.hypot(...v) || 1;
    return v.map((x) => x / norm);
  }

  async embedDocuments(documents: string[]) {
    return documents.map((d) => HashingEmbeddings.vector(d));
  }

  async embedQuery(query: string) {
    return HashingEmbeddings.vector(query);
  }
}

let embeddings: (Embeddings & { modelName: string; defaultMinScore: number }) | undefined;

export function getEmbeddings() {
  embeddings ??= process.env.VOYAGE_API_KEY
    ? new VoyageEmbeddings({
        apiKey: process.env.VOYAGE_API_KEY,
        model: process.env.VOYAGE_MODEL,
        maxRetries: 2,
      })
    : new HashingEmbeddings();
  return embeddings;
}
