import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import type { TournamentStore } from "./types";

let store: TournamentStore | undefined;

/** Postgres when DATABASE_URL is set, otherwise the bundled sample data in memory. */
export function getStore(): TournamentStore {
  store ??= process.env.DATABASE_URL ? new PostgresStore(process.env.DATABASE_URL) : new MemoryStore();
  return store;
}

export type { TournamentStore } from "./types";
