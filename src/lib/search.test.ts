import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSampleTournaments } from "@/lib/data/sample";
import { extractJsonLd } from "@/lib/ingest/jsonld";
import { finalize } from "@/lib/ingest/normalize";
import { HashingEmbeddings } from "@/lib/rag/embeddings";
import { searchInMemory } from "@/lib/store/memory";
import { searchTournaments } from "@/lib/search";

delete process.env.DATABASE_URL;
delete process.env.VOYAGE_API_KEY;

const all = buildSampleTournaments();

test("structured filters apply", () => {
  const { items } = searchInMemory(all, { online: false, country: "united states", maxBuyInUsd: 500 });
  assert.ok(items.length > 0);
  for (const t of items) {
    assert.equal(t.online, false);
    assert.equal(t.country, "United States");
    assert.ok((t.buyInUsd ?? 0) <= 500);
  }
});

test("keyword search requires every term and is accent-insensitive", () => {
  assert.equal(searchInMemory(all, { q: "sao paulo" }).items[0]?.city, "São Paulo");
  assert.equal(searchInMemory(all, { q: "vegas nonexistentword" }).total, 0);
});

test("sorting by buy-in", () => {
  const { items } = searchInMemory(all, { sort: "buyin_asc" });
  for (let i = 1; i < items.length; i++) assert.ok((items[i - 1].buyInUsd ?? 0) <= (items[i].buyInUsd ?? Infinity));
});

test("hybrid search finds natural-language matches keyword search misses", async () => {
  const q = "omaha tournaments in brasil";
  assert.equal(searchInMemory(all, { q }).total, 0);
  const { items } = await searchTournaments({ q });
  assert.ok(items.some((t) => t.game === "PLO" || t.game === "PLO5"), "expected an Omaha event");
});

test("hybrid search still enforces structured filters on vector hits", async () => {
  const { items } = await searchTournaments({ q: "bounty", online: true });
  assert.ok(items.length > 0);
  assert.ok(items.every((t) => t.online));
});

test("hashing embeddings are normalised and deterministic", () => {
  const a = HashingEmbeddings.vector("Las Vegas main event");
  assert.deepEqual(a, HashingEmbeddings.vector("Las Vegas main event"));
  assert.ok(Math.abs(Math.hypot(...a) - 1) < 1e-9);
});

test("JSON-LD events are extracted and normalised", () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
    {"@type":"Event","name":"Autumn PLO Bounty","startDate":"2030-10-01T18:00:00Z",
     "location":{"@type":"Place","name":"Test Casino","address":{"addressLocality":"Vienna","addressCountry":"Austria"}},
     "offers":{"price":"550","priceCurrency":"EUR"}},
    {"@type":"Event","name":"Jazz Night","startDate":"2030-10-02"}]}</script>`;
  const drafts = extractJsonLd(html, false);
  assert.equal(drafts.length, 1, "non-poker events are dropped");
  const t = finalize(drafts[0], "test", "https://example.com")!;
  assert.equal(t.game, "PLO");
  assert.deepEqual(t.formats, ["Bounty"]);
  assert.equal(t.city, "Vienna");
  assert.equal(t.currency, "EUR");
  assert.ok(t.buyInUsd! > 550);
  assert.equal(t.id, "test-autumn-plo-bounty-2030-10-01");
});
