import { getDatabaseUrl } from "@/lib/db-url";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import type { TournamentStore } from "./types";

let store: TournamentStore | undefined;

/** Postgres when a database URL is set, otherwise the bundled sample data in memory. */
export function getStore(): TournamentStore {
  const url = getDatabaseUrl();
  store ??= url ? new PostgresStore(url) : new MemoryStore();
  return store;
}

export type { TournamentStore } from "./types";
