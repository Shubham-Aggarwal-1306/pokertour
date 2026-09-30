import { Document, type DocumentInterface } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/** Optional filter: restrict similarity search to these document ids. */
export type IdFilter = { ids?: string[] };

const cosine = (a: number[], b: number[]) => {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
};

/** In-process vector store for local dev / demo mode (no DATABASE_URL). */
export class InMemoryVectorStore extends VectorStore {
  declare FilterType: IdFilter;
  private rows = new Map<string, { vector: number[]; doc: DocumentInterface }>();

  constructor(embeddings: EmbeddingsInterface) {
    super(embeddings, {});
  }

  _vectorstoreType() {
    return "in-memory";
  }

  async addVectors(vectors: number[][], documents: DocumentInterface[], options?: { ids?: string[] }) {
    const ids = documents.map((d, i) => options?.ids?.[i] ?? d.id ?? String(this.rows.size + i));
    ids.forEach((id, i) => this.rows.set(id, { vector: vectors[i], doc: documents[i] }));
    return ids;
  }

  async addDocuments(documents: DocumentInterface[], options?: { ids?: string[] }) {
    const vectors = await this.embeddings.embedDocuments(documents.map((d) => d.pageContent));
    return this.addVectors(vectors, documents, options);
  }

  async similaritySearchVectorWithScore(query: number[], k: number, filter?: IdFilter) {
    const allowed = filter?.ids ? new Set(filter.ids) : null;
    return [...this.rows.entries()]
      .filter(([id]) => !allowed || allowed.has(id))
      .map(([, r]) => [r.doc, cosine(query, r.vector)] as [DocumentInterface, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);
  }

  async existingContent(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row) out.set(id, row.doc.pageContent);
    }
    return out;
  }
}

/**
 * pgvector-backed store on Neon/Vercel Postgres, using the `tournament_embeddings`
 * table from db/schema.sql. Rows are keyed by tournament id so re-ingesting a
 * tournament replaces its vector instead of duplicating it.
 */
export class NeonVectorStore extends VectorStore {
  declare FilterType: IdFilter;
  private sql: NeonQueryFunction<false, false>;
  private model: string;

  constructor(embeddings: EmbeddingsInterface, fields: { connectionString: string; model: string }) {
    super(embeddings, {});
    this.sql = neon(fields.connectionString);
    this.model = fields.model;
  }

  _vectorstoreType() {
    return "neon-pgvector";
  }

  async addVectors(vectors: number[][], documents: DocumentInterface[], options?: { ids?: string[] }) {
    const ids = documents.map((d, i) => options?.ids?.[i] ?? d.id);
    if (ids.some((id) => !id)) throw new Error("NeonVectorStore requires an id for every document");
    for (let i = 0; i < documents.length; i++) {
      await this.sql.query(
        `INSERT INTO tournament_embeddings (id, content, embedding, model, updated_at)
         VALUES ($1, $2, $3::vector, $4, now())
         ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding,
           model = EXCLUDED.model, updated_at = now()`,
        [ids[i], documents[i].pageContent, JSON.stringify(vectors[i]), this.model],
      );
    }
    return ids as string[];
  }

  async addDocuments(documents: DocumentInterface[], options?: { ids?: string[] }) {
    const vectors = await this.embeddings.embedDocuments(documents.map((d) => d.pageContent));
    return this.addVectors(vectors, documents, options);
  }

  async similaritySearchVectorWithScore(query: number[], k: number, filter?: IdFilter) {
    const params: unknown[] = [JSON.stringify(query), this.model, k];
    let where = "model = $2";
    if (filter?.ids) {
      params.push(filter.ids);
      where += ` AND id = ANY($${params.length})`;
    }
    const rows = (await this.sql.query(
      `SELECT id, content, 1 - (embedding <=> $1::vector) AS score
       FROM tournament_embeddings WHERE ${where}
       ORDER BY embedding <=> $1::vector LIMIT $3`,
      params,
    )) as { id: string; content: string; score: number }[];
    return rows.map(
      (r) => [new Document({ id: r.id, pageContent: r.content, metadata: { id: r.id } }), Number(r.score)] as [DocumentInterface, number],
    );
  }

  /** Embedded content per id for the current model, used to skip re-embedding unchanged records. */
  async existingContent(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = (await this.sql.query(
      "SELECT id, content FROM tournament_embeddings WHERE model = $1 AND id = ANY($2)",
      [this.model, ids],
    )) as { id: string; content: string }[];
    return new Map(rows.map((r) => [r.id, r.content]));
  }
}
