import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabaseUrl } from "./db-url";

test("finds the database URL under the names Vercel's Neon integration uses", () => {
  assert.equal(getDatabaseUrl({ DATABASE_URL: "a", POSTGRES_URL: "b" }), "a");
  assert.equal(getDatabaseUrl({ POSTGRES_URL: "b" }), "b");
  assert.equal(getDatabaseUrl({ STORAGE_DATABASE_URL: "c", STORAGE_DATABASE_URL_UNPOOLED: "d" }), "c");
  assert.equal(getDatabaseUrl({ NEON_POSTGRES_URL: "e" }), "e");
  assert.equal(getDatabaseUrl({ OTHER: "x" }), undefined);
});
