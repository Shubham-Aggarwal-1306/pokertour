import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSampleTournaments } from "@/lib/data/sample";
import { engagementScore, popularityPrior } from "@/lib/popularity";
import { MemoryStore } from "@/lib/store/memory";

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

test("engagement decays with a 7-day half-life and ignores old data", () => {
  const today = engagementScore([{ day: day(0), views: 10, clicks: 0, chats: 0 }]);
  const weekOld = engagementScore([{ day: day(7), views: 10, clicks: 0, chats: 0 }]);
  const stale = engagementScore([{ day: day(40), views: 10, clicks: 0, chats: 0 }]);
  assert.equal(today, 10);
  assert.ok(Math.abs(weekOld - 5) < 1e-9);
  assert.equal(stale, 0);
});

test("clicks and chats weigh more than views", () => {
  const views = engagementScore([{ day: day(0), views: 3, clicks: 0, chats: 0 }]);
  const click = engagementScore([{ day: day(0), views: 0, clicks: 1, chats: 0 }]);
  const chat = engagementScore([{ day: day(0), views: 0, clicks: 0, chats: 1 }]);
  assert.equal(click, views);
  assert.ok(chat > 1);
});

test("with no engagement, bigger guarantees rank first", async () => {
  const { items } = await new MemoryStore().search({ sort: "popular" });
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].popularity! >= items[i].popularity!);
  assert.equal(items[0].popularity, popularityPrior(items[0]));
});

test("user engagement lifts a small event above big-guarantee ones", async () => {
  const store = new MemoryStore(buildSampleTournaments());
  const small = "sample-micro-stakes-turbo-5-50";
  for (let i = 0; i < 10; i++) await store.recordEngagement(small, "click");
  const { items } = await store.search({ sort: "popular", limit: 3 });
  assert.equal(items[0].id, small);
});

test("popular sort only lists upcoming events", async () => {
  const { items } = await new MemoryStore().search({ sort: "popular" });
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(items.every((t) => (t.endDate ?? t.startDate).slice(0, 10) >= today));
});
