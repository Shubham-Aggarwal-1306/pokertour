import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { SearchQuery, SearchResult, Tournament } from "@/lib/types";
import { DEFAULT_LIMIT, todayIso, type SearchOptions, type TournamentStore } from "./types";

type Row = Record<string, unknown>;

const num = (v: unknown) => (v == null ? null : Number(v));
const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());

function fromRow(r: Row): Tournament {
  return {
    id: r.id as string,
    name: r.name as string,
    series: (r.series as string) ?? null,
    organizer: (r.organizer as string) ?? null,
    online: Boolean(r.online),
    platform: (r.platform as string) ?? null,
    venue: (r.venue as string) ?? null,
    city: (r.city as string) ?? null,
    country: (r.country as string) ?? null,
    startDate: iso(r.start_date)!,
    endDate: iso(r.end_date),
    timezone: (r.timezone as string) ?? null,
    buyIn: num(r.buy_in),
    currency: (r.currency as string) ?? null,
    buyInUsd: num(r.buy_in_usd),
    guaranteeUsd: num(r.guarantee_usd),
    game: r.game as Tournament["game"],
    formats: (r.formats as Tournament["formats"]) ?? [],
    startingStack: num(r.starting_stack),
    blindLevelMinutes: num(r.blind_level_minutes),
    lateRegistration: (r.late_registration as string) ?? null,
    description: (r.description as string) ?? null,
    url: (r.url as string) ?? null,
    source: r.source as string,
    sourceUrl: (r.source_url as string) ?? null,
    updatedAt: iso(r.updated_at)!,
  };
}

const ORDER: Record<string, string> = {
  date: "start_date ASC",
  buyin_asc: "buy_in_usd ASC NULLS LAST, start_date ASC",
  buyin_desc: "buy_in_usd DESC NULLS LAST, start_date ASC",
  guarantee_desc: "guarantee_usd DESC NULLS LAST, start_date ASC",
  relevance: "rank DESC, start_date ASC",
};

export class PostgresStore implements TournamentStore {
  private sql: NeonQueryFunction<false, false>;

  constructor(url: string) {
    this.sql = neon(url);
  }

  async search(query: SearchQuery, options: SearchOptions = {}): Promise<SearchResult> {
    const where: string[] = [];
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    if (options.ids) where.push(`id = ANY(${p(options.ids)})`);
    where.push(`coalesce(end_date, start_date) >= ${p(query.from ?? todayIso())}::date`);
    if (query.to) where.push(`start_date < (${p(query.to)}::date + 1)`);
    if (query.online !== undefined) where.push(`online = ${p(query.online)}`);
    if (query.country) where.push(`lower(country) = lower(${p(query.country)})`);
    if (query.city) where.push(`lower(city) = lower(${p(query.city)})`);
    if (query.game) where.push(`game = ${p(query.game)}`);
    if (query.format) where.push(`${p(query.format)} = ANY(formats)`);
    if (query.minBuyInUsd !== undefined) where.push(`buy_in_usd >= ${p(query.minBuyInUsd)}`);
    if (query.maxBuyInUsd !== undefined) where.push(`buy_in_usd <= ${p(query.maxBuyInUsd)}`);
    if (query.minGuaranteeUsd !== undefined) where.push(`guarantee_usd >= ${p(query.minGuaranteeUsd)}`);

    let rank = "0";
    if (query.q) {
      // prefix matching on every term: "vega main" -> vega:* & main:*
      const tsq = query.q
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
        .filter(Boolean)
        .map((w) => `${w}:*`)
        .join(" & ");
      if (tsq) {
        const ref = p(tsq);
        where.push(`search @@ to_tsquery('simple', ${ref})`);
        rank = `ts_rank(search, to_tsquery('simple', ${ref}))`;
      }
    }

    const sort = query.sort ?? (query.q ? "relevance" : "date");
    const limit = p(query.limit ?? DEFAULT_LIMIT);
    const offset = p(query.offset ?? 0);
    const text = `
      SELECT *, ${rank} AS rank, count(*) OVER() AS total
      FROM tournaments
      WHERE ${where.join(" AND ")}
      ORDER BY ${ORDER[sort] ?? ORDER.date}
      LIMIT ${limit} OFFSET ${offset}`;

    const rows = (await this.sql.query(text, params)) as Row[];
    return { items: rows.map(fromRow), total: rows.length ? Number(rows[0].total) : 0 };
  }

  async get(id: string) {
    const rows = (await this.sql.query("SELECT * FROM tournaments WHERE id = $1", [id])) as Row[];
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async upsert(tournaments: Tournament[]) {
    for (const t of tournaments) {
      await this.sql.query(
        `INSERT INTO tournaments (
          id, name, series, organizer, online, platform, venue, city, country,
          start_date, end_date, timezone, buy_in, currency, buy_in_usd, guarantee_usd,
          game, formats, starting_stack, blind_level_minutes, late_registration,
          description, url, source, source_url, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, series = EXCLUDED.series, organizer = EXCLUDED.organizer,
          online = EXCLUDED.online, platform = EXCLUDED.platform, venue = EXCLUDED.venue,
          city = EXCLUDED.city, country = EXCLUDED.country, start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date, timezone = EXCLUDED.timezone, buy_in = EXCLUDED.buy_in,
          currency = EXCLUDED.currency, buy_in_usd = EXCLUDED.buy_in_usd,
          guarantee_usd = EXCLUDED.guarantee_usd, game = EXCLUDED.game, formats = EXCLUDED.formats,
          starting_stack = EXCLUDED.starting_stack, blind_level_minutes = EXCLUDED.blind_level_minutes,
          late_registration = EXCLUDED.late_registration, description = EXCLUDED.description,
          url = EXCLUDED.url, source = EXCLUDED.source, source_url = EXCLUDED.source_url,
          updated_at = now()`,
        [
          t.id, t.name, t.series, t.organizer, t.online, t.platform, t.venue, t.city, t.country,
          t.startDate, t.endDate, t.timezone, t.buyIn, t.currency, t.buyInUsd, t.guaranteeUsd,
          t.game, t.formats, t.startingStack, t.blindLevelMinutes, t.lateRegistration,
          t.description, t.url, t.source, t.sourceUrl,
        ],
      );
    }
    return tournaments.length;
  }

  async getSourceHash(url: string) {
    const rows = (await this.sql.query("SELECT content_hash FROM source_pages WHERE url = $1", [url])) as Row[];
    return (rows[0]?.content_hash as string) ?? null;
  }

  async setSourceHash(url: string, hash: string) {
    await this.sql.query(
      `INSERT INTO source_pages (url, content_hash, fetched_at) VALUES ($1, $2, now())
       ON CONFLICT (url) DO UPDATE SET content_hash = EXCLUDED.content_hash, fetched_at = now()`,
      [url, hash],
    );
  }
}
