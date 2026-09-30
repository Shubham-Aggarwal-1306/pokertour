import Link from "next/link";
import { formatCompactUsd, formatMoney } from "@/lib/currency";
import type { Tournament } from "@/lib/types";

export function formatDateRange(t: Pick<Tournament, "startDate" | "endDate">): string {
  const fmt = (iso: string, withYear: boolean) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    });
  if (!t.endDate) return fmt(t.startDate, true);
  return `${fmt(t.startDate, false)} – ${fmt(t.endDate, true)}`;
}

export function locationLabel(t: Tournament): string {
  if (t.online) return `Online · ${t.platform ?? "Unknown platform"}`;
  return [t.venue, t.city, t.country].filter(Boolean).join(", ") || "Location TBA";
}

export function TournamentCard({ t, compact = false }: { t: Tournament; compact?: boolean }) {
  return (
    <Link
      href={`/tournaments/${encodeURIComponent(t.id)}`}
      className="block rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{t.name}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">{locationLabel(t)}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold">{formatMoney(t.buyIn, t.currency)}</div>
          {t.guaranteeUsd ? <div className="text-xs text-muted">{formatCompactUsd(t.guaranteeUsd)} GTD</div> : null}
        </div>
      </div>
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">{formatDateRange(t)}</span>
          <span className="rounded bg-chip px-1.5 py-0.5">{t.game}</span>
          {t.formats.map((f) => (
            <span key={f} className="rounded bg-chip px-1.5 py-0.5">
              {f}
            </span>
          ))}
          {t.source === "sample" && (
            <span className="rounded border border-border px-1.5 py-0.5 text-muted">Demo data</span>
          )}
        </div>
      )}
    </Link>
  );
}
