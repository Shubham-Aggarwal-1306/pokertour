# ♠ PokerTour

A public search engine for poker tournaments worldwide. Users can search live and online events by location, buy-in, game, format and date, and chat with an AI assistant that finds relevant tournaments and answers questions about them. The assistant uses RAG over a vector index of the tournament data.

Built with Next.js (App Router) for Vercel, LangChain + Claude for the assistant, and Postgres + pgvector (Neon) for storage and vector search.

## How it works

```
 sources (casino/tour schedule pages)
        │  Vercel Cron → /api/cron/ingest (daily)
        ▼
 extract: schema.org JSON-LD (free) ──► AI extraction fallback (opt-in, Haiku, only when page changed)
        ▼
 normalise (game/format inference, USD buy-in) ──► Postgres `tournaments`
        ▼
 embed (Voyage voyage-3.5-lite, only new/changed records) ──► pgvector `tournament_embeddings`

 search page / API / AI tools
        ▼
 hybrid retrieval: structured SQL filters + keyword (tsvector) + vector similarity, merged by reciprocal rank fusion
        ▼
 LangChain agent (createAgent + ChatAnthropic) with `search_tournaments` / `get_tournament` tools → grounded answers
```

| Piece | Where |
| --- | --- |
| Search UI (server-rendered, works without JS) | `src/app/page.tsx`, `src/components/Filters.tsx` |
| Tournament page + contextual chat | `src/app/tournaments/[id]/page.tsx` |
| Chat UI (streams NDJSON) | `src/components/Chat.tsx` |
| Chat API / LangChain agent | `src/app/api/chat/route.ts`, `src/lib/ai/*` |
| Hybrid search (RAG retrieval) | `src/lib/search.ts` |
| Embeddings + vector stores (LangChain `Embeddings` / `VectorStore`) | `src/lib/rag/*` |
| Data store (Postgres or in-memory demo) | `src/lib/store/*` |
| Ingestion pipeline | `src/lib/ingest/*`, `src/app/api/cron/ingest/route.ts` |
| DB schema | `db/schema.sql` |

With no env vars set, the app runs entirely on bundled **fictional demo data**, which is labelled "Demo data" in the UI. It uses an in-memory vector store and a free local embedder, so you can try it before wiring anything up.

## Keeping AI costs low

The assistant is public, so every request is built to be cheap:

- **Model:** `claude-haiku-4-5` by default ($1 / $5 per million input/output tokens). Set `ANTHROPIC_MODEL` to upgrade.
- **Short, stable system prompt and terse tool schemas.** These are resent on every call, so they're kept small.
- **Compact tool results:** one line of text per tournament instead of JSON. Full records go to the UI as artifacts and are never sent to the model.
- **History window:** only the last 6 messages, each truncated. Past tool calls are not replayed.
- **Hard limits:** 500-char input, 700 output tokens, at most 3 tool rounds per question (`modelCallLimitMiddleware`), and a per-IP rate limit.
- **Tournament pages:** the tournament's details are put in the prompt directly, so simple questions need no tool call.
- **Embeddings:** `voyage-3.5-lite` at 512 dimensions. Only new or changed records are embedded, and query embeddings are LRU-cached.
- **Ingestion:** JSON-LD extraction is free. AI extraction is opt-in per source, runs on stripped text capped at 24k characters, and is skipped when the page hash hasn't changed.

All limits can be tuned with the `CHAT_*` env vars (see `.env.example`).

## Scope guard

The system prompt restricts the assistant to poker tournaments. Off-topic requests, including attempts to override the rules, get a one-sentence decline with no answer to the off-topic part. It must use the tools for facts and never invent events.

## Local development

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY to enable chat
npm run dev                  # http://localhost:3000
npm test                     # unit tests (no API calls; the agent test uses a fake model)
```

## Deploy to Vercel

1. Import the repo in Vercel.
2. **Database:** add **Neon** from the Vercel Marketplace (Storage tab). This sets `DATABASE_URL`. Then create the tables and pgvector index:
   ```bash
   vercel env pull .env.local   # scripts read .env.local automatically
   npm run db:migrate
   npm run db:seed              # optional: load the demo data
   ```
3. **Env vars** (Project → Settings → Environment Variables):
   - `ANTHROPIC_API_KEY`: required for chat.
   - `VOYAGE_API_KEY`: recommended for real semantic search. Get one at dash.voyageai.com; it has a free tier.
   - `CRON_SECRET`: any long random string. Vercel sends it to the cron route.
   - `INGEST_SOURCES`: JSON list of schedule pages, e.g.
     `[{"id":"my-casino","url":"https://example.com/poker/schedule","ai":true}]`
4. Deploy. `vercel.json` schedules `/api/cron/ingest` daily at 06:00 UTC.

Only ingest sites whose terms allow it, and respect robots.txt. Partner feeds or organizer submissions are the most reliable long-term data source.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Apply `db/schema.sql` (tables, full-text + HNSW vector indexes) |
| `npm run db:seed` | Load and embed the demo tournaments |
| `npm run ingest [-- --force]` | Run ingestion locally (`--force` ignores page hashes) |
| `npm run rag:reindex` | Re-embed all tournaments (after changing `VOYAGE_MODEL` or the embedded text format) |

## Next steps

- Add real sources (tour/casino schedule pages, or partner APIs/feeds).
- Organizer submission form with moderation.
- Shared rate limiting (Upstash / Vercel KV) for strict global limits.
- Map view and "near me" search (add lat/lng + PostGIS).
