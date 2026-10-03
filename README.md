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
| Search UI (server-rendered, works without JS) + "Trending now" | `src/app/page.tsx`, `src/components/Filters.tsx` |
| Popularity ranking + engagement tracking | `src/lib/popularity.ts`, `src/lib/engagement.ts`, `src/app/api/tournaments/[id]/engage/route.ts` |
| Tournament page + contextual chat | `src/app/tournaments/[id]/page.tsx` |
| Chat UI (streams NDJSON) | `src/components/Chat.tsx` |
| Chat API / LangChain agent | `src/app/api/chat/route.ts`, `src/lib/ai/*` |
| Hybrid search (RAG retrieval) | `src/lib/search.ts` |
| Embeddings + vector stores (LangChain `Embeddings` / `VectorStore`) | `src/lib/rag/*` |
| Data store (Postgres or in-memory demo) | `src/lib/store/*` |
| Ingestion pipeline | `src/lib/ingest/*`, `src/app/api/cron/ingest/route.ts` |
| DB schema | `db/schema.sql` |

With no env vars set, the app runs entirely on bundled **fictional demo data**, which is labelled "Demo data" in the UI. It uses an in-memory vector store and a free local embedder, so you can try it before wiring anything up.

## Popularity ranking

"Most popular" (`sort=popular`) ranks **upcoming** tournaments by:

```
popularity = Σ last 30 days of (views·1 + official-link clicks·3 + chat questions·2) · 0.5^(age/7 days)
           + 2 · log10(1 + guaranteeUsd / 1000)
```

- **Engagement:** page views and clicks to the official page are sent from the tournament page as beacons. Chat questions about a tournament are recorded server-side.
- **Anti-inflation:** each IP counts at most once per tournament per signal every 6 hours, and obvious bots are ignored.
- **Decay:** with a 7-day half-life, "trending" reflects current interest.
- **Baseline:** the guarantee-based prior gives brand-new events a sensible starting rank before they have traffic.

Engagement is stored as daily counters in `tournament_engagement` and scored at query time. The landing page shows the top 6 events of the next 60 days as **Trending now**. The API (`/api/tournaments?sort=popular`) and the AI assistant ("what's popular this month?") use the same ranking. Tune the weights in `src/lib/popularity.ts`.

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

## Secrets

Vercel is the single source of truth for secrets. Nothing secret needs to live in the repo or on a laptop:

- **On Vercel:** the app and the build read the project's Environment Variables directly.
- **Locally:** every script that needs secrets runs through `vercel env run`. It fetches the project's variables from Vercel and passes them only to that one process. No `.env` file is written.

```bash
npm i -g vercel        # or let the scripts use npx
vercel login
vercel link            # once per checkout: pick the pokertour project
```

The database URL is detected under any name the Neon integration uses (`DATABASE_URL`, `POSTGRES_URL`, or a prefixed variant such as `STORAGE_DATABASE_URL`).

## Local development

```bash
npm install
npm run dev            # demo data, no secrets needed: http://localhost:3000
npm run dev:vercel     # same, but with the project's Development env vars from Vercel
npm test               # unit tests (no API calls; the agent test uses a fake model)
```

`dev:vercel` uses the **Development** environment. Tick "Development" when adding a variable in Vercel if you want it available locally. Use a separate dev database or Neon branch rather than pointing local dev at production data.

## Deploy to Vercel

1. Import the repo in Vercel and deploy. With no env vars, it serves the demo data.
2. **Database:** Storage → Create → **Neon** → connect it to the project. Then redeploy.
   **Migrations run automatically on every deploy.** `vercel.json` sets the build command to `npm run vercel-build`, which applies `db/schema.sql` with the project's own secrets before `next build`. Every statement is idempotent.
   To load the demo tournaments into the database, set `SEED_DEMO_DATA=true` for one deploy, or run `npm run db:seed` locally.
3. **Env vars** (Project → Settings → Environment Variables):
   - `ANTHROPIC_API_KEY`: required for chat.
   - `VOYAGE_API_KEY`: recommended for real semantic search. Get one at dash.voyageai.com; it has a free tier.
   - `CRON_SECRET`: any long random string. Vercel sends it to the cron route.
   - `INGEST_SOURCES`: JSON list of schedule pages, e.g.
     `[{"id":"my-casino","url":"https://example.com/poker/schedule","ai":true}]`
4. Redeploy after changing env vars. `vercel.json` also schedules `/api/cron/ingest` daily at 06:00 UTC.

Only ingest sites whose terms allow it, and respect robots.txt. Partner feeds or organizer submissions are the most reliable long-term data source.

### Useful scripts

These run with the **Production** env vars from Vercel (via `vercel env run -e production`). For another environment, run e.g. `npx vercel env run -e preview -- tsx scripts/seed.ts`.

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Apply `db/schema.sql` manually (also runs on every deploy) |
| `npm run db:seed` | Load and embed the demo tournaments |
| `npm run ingest [-- --force]` | Run ingestion now (`--force` ignores page hashes) |
| `npm run rag:reindex` | Re-embed all tournaments (after changing `VOYAGE_MODEL` or the embedded text format) |

## Next steps

- Add real sources (tour/casino schedule pages, or partner APIs/feeds).
- Organizer submission form with moderation.
- Shared rate limiting (Upstash / Vercel KV) for strict global limits.
- Map view and "near me" search (add lat/lng + PostGIS).
