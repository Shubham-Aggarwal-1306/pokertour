import { looksLikePoker, type Draft } from "./normalize";

type Json = Record<string, unknown>;

const EVENT_TYPES = new Set(["Event", "SportsEvent", "SocialEvent", "EventSeries"]);

const str = (v: unknown): string | undefined => {
  if (typeof v === "string") return v.trim() || undefined;
  if (Array.isArray(v)) return str(v[0]);
  if (v && typeof v === "object" && "name" in v) return str((v as Json).name);
  return undefined;
};

const isEvent = (node: Json) => {
  const t = node["@type"];
  return (Array.isArray(t) ? t : [t]).some((x) => typeof x === "string" && EVENT_TYPES.has(x));
};

function collectEvents(node: unknown, out: Json[]) {
  if (Array.isArray(node)) return node.forEach((n) => collectEvents(n, out));
  if (!node || typeof node !== "object") return;
  const obj = node as Json;
  if (isEvent(obj)) out.push(obj);
  if (obj["@graph"]) collectEvents(obj["@graph"], out);
  if (obj.subEvent) collectEvents(obj.subEvent, out);
}

function toDraft(e: Json, pokerOnlySource: boolean): Draft | null {
  const name = str(e.name);
  const startDate = str(e.startDate);
  if (!name || !startDate) return null;
  const description = str(e.description);
  if (!pokerOnlySource && !looksLikePoker(`${name} ${description ?? ""}`)) return null;

  const location = (Array.isArray(e.location) ? e.location[0] : e.location) as Json | undefined;
  const address = (location?.address ?? {}) as Json;
  const online =
    str(e.eventAttendanceMode)?.includes("Online") || location?.["@type"] === "VirtualLocation" || false;
  const offers = (Array.isArray(e.offers) ? e.offers[0] : e.offers) as Json | undefined;
  const price = offers?.price != null ? Number(offers.price) : undefined;

  return {
    name,
    startDate,
    endDate: str(e.endDate) ?? null,
    description: description ?? null,
    online,
    venue: online ? null : str(location?.name) ?? null,
    city: str(address.addressLocality) ?? null,
    country: str(address.addressCountry) ?? null,
    organizer: str(e.organizer) ?? null,
    series: str(e.superEvent) ?? null,
    buyIn: price != null && Number.isFinite(price) ? price : null,
    currency: str(offers?.priceCurrency) ?? null,
    url: str(e.url) ?? null,
  };
}

/**
 * Extract tournaments from schema.org Event JSON-LD embedded in a page. Free
 * (no AI tokens) and reliable when present, so it always runs first.
 */
export function extractJsonLd(html: string, pokerOnlySource = false): Draft[] {
  const events: Json[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      collectEvents(JSON.parse(m[1].trim()), events);
    } catch {
      // ignore malformed blocks
    }
  }
  return events.map((e) => toDraft(e, pokerOnlySource)).filter((d): d is Draft => d !== null);
}
