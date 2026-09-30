import { formatMoney } from "@/lib/currency";
import type { Tournament } from "@/lib/types";

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/**
 * One compact line per tournament. Plain text is several times cheaper in input
 * tokens than the full JSON record and carries everything needed to answer
 * "what/where/when/how much" questions.
 */
export function tournamentLine(t: Tournament): string {
  const where = t.online ? `online (${t.platform ?? "?"})` : [t.venue, t.city, t.country].filter(Boolean).join(", ");
  const when = t.endDate ? `${day(t.startDate)}..${day(t.endDate)}` : day(t.startDate);
  const buyIn = t.buyIn == null ? "buy-in ?" : `buy-in ${formatMoney(t.buyIn, t.currency)}`;
  const gtd = t.guaranteeUsd ? ` | GTD $${t.guaranteeUsd.toLocaleString("en-US")}` : "";
  return `[${t.id}] ${t.name} | ${when} | ${where} | ${buyIn}${gtd} | ${t.game} ${t.formats.join("/")}`;
}

/** Full detail for a single tournament, still as terse text. */
export function tournamentDetail(t: Tournament): string {
  const rows: [string, unknown][] = [
    ["Series", t.series],
    ["Organizer", t.organizer],
    ["Start (UTC)", t.startDate],
    ["End (UTC)", t.endDate],
    ["Timezone", t.timezone],
    ["Starting stack", t.startingStack],
    ["Blind levels (min)", t.blindLevelMinutes],
    ["Late reg", t.lateRegistration],
    ["Buy-in USD approx", t.buyInUsd],
    ["Official URL", t.url],
    ["Source", t.source === "sample" ? "sample/demo data (fictional)" : t.sourceUrl ?? t.source],
    ["Description", t.description],
  ];
  return [
    tournamentLine(t),
    ...rows.filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}: ${v}`),
  ].join("\n");
}
