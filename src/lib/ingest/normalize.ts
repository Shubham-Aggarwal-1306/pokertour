import { toUsd } from "@/lib/currency";
import { FORMATS, GAME_TYPES, type Tournament } from "@/lib/types";

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

const POKER_WORDS =
  /\b(poker|hold'?em|holdem|nlh|nlhe|plo|omaha|short ?deck|stud|razz|freezeout|re-?entry|deepstack|satellite|bounty|pko|high roller|main event|wsop|wpt|ept)\b/i;

export const looksLikePoker = (text: string) => POKER_WORDS.test(text);

export function inferGame(text: string): Tournament["game"] {
  const t = text.toLowerCase();
  if (/\bplo ?5|5[- ]card (plo|omaha)|big o\b/.test(t)) return "PLO5";
  if (/\bplo\b|omaha/.test(t)) return "PLO";
  if (/short ?deck|6\+/.test(t)) return "Short Deck";
  if (/mixed|horse|8[- ]game|dealer'?s choice/.test(t)) return "Mixed";
  if (/\bstud\b|razz/.test(t)) return "Stud";
  return "NLH";
}

export function inferFormats(text: string): Tournament["formats"] {
  const t = text.toLowerCase();
  const out = new Set<Tournament["formats"][number]>();
  if (/mystery bounty/.test(t)) out.add("Mystery Bounty");
  else if (/bounty|pko|knockout/.test(t)) out.add("Bounty");
  if (/freezeout/.test(t)) out.add("Freezeout");
  if (/re-?entry/.test(t)) out.add("Re-entry");
  if (/rebuy/.test(t)) out.add("Rebuy");
  if (/deep ?stack/.test(t)) out.add("Deepstack");
  if (/turbo|hyper/.test(t)) out.add("Turbo");
  if (/satellite|qualifier/.test(t)) out.add("Satellite");
  if (/high roller/.test(t)) out.add("High Roller");
  if (/main event/.test(t)) out.add("Main Event");
  return [...out];
}

export const asGame = (g: unknown, fallbackText: string): Tournament["game"] =>
  (GAME_TYPES as readonly string[]).includes(g as string) ? (g as Tournament["game"]) : inferGame(fallbackText);

export const asFormats = (f: unknown, fallbackText: string): Tournament["formats"] => {
  const valid = Array.isArray(f) ? f.filter((x): x is Tournament["formats"][number] => (FORMATS as readonly string[]).includes(x)) : [];
  return valid.length ? valid : inferFormats(fallbackText);
};

export type Draft = Partial<Tournament> & Pick<Tournament, "name" | "startDate">;

/** Fill derived fields and a stable id so repeated ingests update the same row. */
export function finalize(draft: Draft, sourceId: string, sourceUrl: string): Tournament | null {
  const start = new Date(draft.startDate);
  if (Number.isNaN(start.getTime())) return null;
  const end = draft.endDate ? new Date(draft.endDate) : null;
  const text = [draft.name, draft.series, draft.description].filter(Boolean).join(" ");
  const currency = draft.currency?.toUpperCase() ?? null;
  return {
    id: `${sourceId}-${slugify(draft.name)}-${start.toISOString().slice(0, 10)}`,
    name: draft.name.trim(),
    series: draft.series ?? null,
    organizer: draft.organizer ?? null,
    online: draft.online ?? false,
    platform: draft.platform ?? null,
    venue: draft.venue ?? null,
    city: draft.city ?? null,
    country: draft.country ?? null,
    startDate: start.toISOString(),
    endDate: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
    timezone: draft.timezone ?? null,
    buyIn: draft.buyIn ?? null,
    currency,
    buyInUsd: toUsd(draft.buyIn ?? null, currency),
    guaranteeUsd: draft.guaranteeUsd ?? null,
    game: asGame(draft.game, text),
    formats: asFormats(draft.formats, text),
    startingStack: draft.startingStack ?? null,
    blindLevelMinutes: draft.blindLevelMinutes ?? null,
    lateRegistration: draft.lateRegistration ?? null,
    description: draft.description?.slice(0, 2000) ?? null,
    url: draft.url ?? sourceUrl,
    source: sourceId,
    sourceUrl,
    updatedAt: new Date().toISOString(),
  };
}
