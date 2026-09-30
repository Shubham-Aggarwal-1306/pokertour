-- Postgres schema (Neon / Vercel Postgres / Supabase all work).
-- Apply with: npm run db:migrate

CREATE TABLE IF NOT EXISTS tournaments (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  series              TEXT,
  organizer           TEXT,
  online              BOOLEAN NOT NULL DEFAULT FALSE,
  platform            TEXT,
  venue               TEXT,
  city                TEXT,
  country             TEXT,
  start_date          TIMESTAMPTZ NOT NULL,
  end_date            TIMESTAMPTZ,
  timezone            TEXT,
  buy_in              NUMERIC,
  currency            TEXT,
  buy_in_usd          NUMERIC,
  guarantee_usd       NUMERIC,
  game                TEXT NOT NULL,
  formats             TEXT[] NOT NULL DEFAULT '{}',
  starting_stack      INTEGER,
  blind_level_minutes INTEGER,
  late_registration   TEXT,
  description         TEXT,
  url                 TEXT,
  source              TEXT NOT NULL,
  source_url          TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  search              TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(series, '') || ' ' || coalesce(city, '') || ' ' || coalesce(platform, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(organizer, '') || ' ' || coalesce(venue, '') || ' ' || coalesce(country, '') || ' ' || game), 'C') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'D')
  ) STORED
);

CREATE INDEX IF NOT EXISTS tournaments_search_idx ON tournaments USING GIN (search);
CREATE INDEX IF NOT EXISTS tournaments_start_idx ON tournaments (start_date);
CREATE INDEX IF NOT EXISTS tournaments_country_idx ON tournaments (lower(country));
CREATE INDEX IF NOT EXISTS tournaments_city_idx ON tournaments (lower(city));

-- Remembers each source page's content hash so unchanged pages are not re-extracted.
CREATE TABLE IF NOT EXISTS source_pages (
  url          TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RAG: one embedding per tournament (pgvector). Dimension must match
-- EMBEDDING_DIMENSIONS in src/lib/rag/embeddings.ts.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tournament_embeddings (
  id         TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  embedding  VECTOR(512) NOT NULL,
  model      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournament_embeddings_hnsw_idx
  ON tournament_embeddings USING hnsw (embedding vector_cosine_ops);
