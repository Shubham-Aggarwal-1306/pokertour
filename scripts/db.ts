import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { buildSampleTournaments } from "../src/lib/data/sample";
import { requireDatabaseUrl } from "../src/lib/db-url";
import { indexTournaments } from "../src/lib/rag";
import { getStore } from "../src/lib/store";

/** Apply db/schema.sql. Every statement is idempotent (IF NOT EXISTS), so it is safe on every deploy. */
export async function migrate() {
  const sql = neon(requireDatabaseUrl());
  const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");
  const statements = schema
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`Schema up to date (${statements.length} statements).`);
}

/** Load the fictional demo tournaments and embed them. */
export async function seed() {
  requireDatabaseUrl();
  const tournaments = buildSampleTournaments();
  await getStore().upsert(tournaments);
  const embedded = await indexTournaments(tournaments);
  console.log(`Seeded ${tournaments.length} demo tournaments (${embedded} embedded).`);
}

/** Re-embed every stored tournament (after changing VOYAGE_MODEL or the embedded text format). */
export async function reindex() {
  requireDatabaseUrl();
  const { items } = await getStore().search({ from: "1970-01-01", limit: 100_000 });
  const embedded = await indexTournaments(items);
  console.log(`Embedded ${embedded} of ${items.length} tournaments.`);
}
