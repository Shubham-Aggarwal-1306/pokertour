import { SearchQuerySchema, type SearchQuery } from "@/lib/types";

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

/** Parse URL query params (search page and GET /api/tournaments) into a validated SearchQuery. */
export function parseSearchParams(input: Params): SearchQuery {
  const get = (k: string) => {
    const v = input instanceof URLSearchParams ? input.get(k) : input[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s == null || s === "" ? undefined : s;
  };
  const num = (k: string) => {
    const v = get(k);
    return v == null || Number.isNaN(Number(v)) ? undefined : Number(v);
  };
  const online = get("online");

  const raw = {
    q: get("q"),
    country: get("country"),
    city: get("city"),
    online: online === "true" ? true : online === "false" ? false : undefined,
    game: get("game"),
    format: get("format"),
    minBuyInUsd: num("minBuyInUsd"),
    maxBuyInUsd: num("maxBuyInUsd"),
    minGuaranteeUsd: num("minGuaranteeUsd"),
    from: get("from"),
    to: get("to"),
    sort: get("sort"),
    limit: num("limit"),
    offset: num("offset"),
  };

  // Drop invalid individual fields instead of rejecting the whole query.
  const result: Record<string, unknown> = {};
  const shape = SearchQuerySchema.shape;
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    const field = shape[key as keyof typeof shape].safeParse(value);
    if (field.success) result[key] = field.data;
  }
  return result as SearchQuery;
}
