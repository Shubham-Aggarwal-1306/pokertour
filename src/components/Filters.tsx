import { FORMATS, GAME_TYPES, type SearchQuery } from "@/lib/types";

/** Plain GET form: works without JavaScript and keeps results shareable by URL. */
export function Filters({ query }: { query: SearchQuery }) {
  const online = query.online === undefined ? "" : String(query.online);
  return (
    <form action="/" method="get" className="space-y-3">
      <div className="flex gap-2">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Search tournaments, series, venues, cities…"
          className="input"
          aria-label="Search"
        />
        <button className="btn" type="submit">
          Search
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select name="online" defaultValue={online} className="input" aria-label="Live or online">
          <option value="">Live + online</option>
          <option value="false">Live only</option>
          <option value="true">Online only</option>
        </select>
        <input name="country" defaultValue={query.country} placeholder="Country" className="input" />
        <input name="city" defaultValue={query.city} placeholder="City" className="input" />
        <select name="game" defaultValue={query.game ?? ""} className="input" aria-label="Game">
          <option value="">Any game</option>
          {GAME_TYPES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select name="format" defaultValue={query.format ?? ""} className="input" aria-label="Format">
          <option value="">Any format</option>
          {FORMATS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <input
          name="maxBuyInUsd"
          type="number"
          min={0}
          defaultValue={query.maxBuyInUsd}
          placeholder="Max buy-in $"
          className="input"
        />
        <input name="from" type="date" defaultValue={query.from} className="input" aria-label="From date" />
        <select name="sort" defaultValue={query.sort ?? ""} className="input" aria-label="Sort">
          <option value="">Best match</option>
          <option value="popular">Most popular</option>
          <option value="date">Soonest</option>
          <option value="buyin_asc">Buy-in: low → high</option>
          <option value="buyin_desc">Buy-in: high → low</option>
          <option value="guarantee_desc">Biggest guarantee</option>
        </select>
      </div>
    </form>
  );
}
