import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeToolCallingModel } from "langchain";
import { runChat, trimHistory, type ChatEvent } from "./chat";

delete process.env.DATABASE_URL;
delete process.env.VOYAGE_API_KEY;

test("history is windowed, trimmed and starts with a user turn", () => {
  const msgs = Array.from({ length: 11 }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: "x".repeat(5000),
  }));
  const out = trimHistory(msgs);
  assert.ok(out.length <= 6);
  assert.equal(out[0].type, "human");
  assert.ok(out.every((m) => String(m.content).length <= 1200));
});

test("agent retrieves tournaments via the search tool and streams them", async () => {
  const model = new FakeToolCallingModel({
    toolCalls: [[{ name: "search_tournaments", args: { q: "mystery bounty", online: false }, id: "call_1" }], []],
  });
  const events: ChatEvent[] = [];
  for await (const e of runChat([{ role: "user", content: "any mystery bounty events?" }], { model })) {
    events.push(e);
  }
  const cards = events.find((e) => e.type === "tournaments");
  assert.ok(cards && cards.type === "tournaments" && cards.items.length > 0, JSON.stringify(events));
  assert.ok(cards.items.some((t) => t.formats.includes("Mystery Bounty")));
});
