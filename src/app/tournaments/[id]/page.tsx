import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Chat } from "@/components/Chat";
import { formatDateRange, locationLabel } from "@/components/TournamentCard";
import { formatMoney } from "@/lib/currency";
import { getStore } from "@/lib/store";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getStore().get(decodeURIComponent((await params).id));
  return t ? { title: `${t.name} — PokerTour`, description: t.description ?? undefined } : {};
}

export default async function TournamentPage({ params }: Props) {
  const t = await getStore().get(decodeURIComponent((await params).id));
  if (!t) notFound();

  const facts: [string, React.ReactNode][] = [
    ["Dates", formatDateRange(t)],
    ["Where", locationLabel(t)],
    ["Buy-in", `${formatMoney(t.buyIn, t.currency)}${t.currency !== "USD" && t.buyInUsd ? ` (≈ $${t.buyInUsd.toLocaleString("en-US")})` : ""}`],
    ["Guarantee", t.guaranteeUsd ? `$${t.guaranteeUsd.toLocaleString("en-US")}` : null],
    ["Game", t.game],
    ["Format", t.formats.join(", ") || null],
    ["Starting stack", t.startingStack?.toLocaleString("en-US")],
    ["Blind levels", t.blindLevelMinutes ? `${t.blindLevelMinutes} min` : null],
    ["Late registration", t.lateRegistration],
    ["Series", t.series],
    ["Organizer", t.organizer],
    ["Time zone", t.timezone],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <article className="min-w-0 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.name}</h1>
          <p className="text-muted">{locationLabel(t)}</p>
        </div>
        {t.source === "sample" && (
          <p className="rounded-lg border border-border bg-chip p-3 text-sm">
            This is fictional demo data bundled with the app. Connect a database and ingestion sources to show real events.
          </p>
        )}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          {facts
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
        </dl>
        {t.description && <p className="leading-relaxed">{t.description}</p>}
        <div className="flex flex-wrap gap-3 text-sm">
          {t.url && (
            <a className="btn" href={t.url} target="_blank" rel="noopener noreferrer">
              Official page ↗
            </a>
          )}
          {t.sourceUrl && t.sourceUrl !== t.url && (
            <a className="text-muted underline" href={t.sourceUrl} target="_blank" rel="noopener noreferrer">
              Source
            </a>
          )}
          <span className="self-center text-xs text-muted">
            Updated {new Date(t.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
          </span>
        </div>
      </article>
      <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
        <Chat
          title="Ask about this tournament"
          tournamentId={t.id}
          placeholder="e.g. How deep is the structure?"
          suggestions={["Is this a good event for a recreational player?", "Are there satellites?", "Similar events nearby"]}
        />
      </aside>
    </div>
  );
}
