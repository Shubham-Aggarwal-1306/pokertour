import Link from "next/link";
import { Chat } from "@/components/Chat";
import { Filters } from "@/components/Filters";
import { TournamentCard } from "@/components/TournamentCard";
import { parseSearchParams } from "@/lib/search-params";
import { searchTournaments } from "@/lib/search";

const PAGE_SIZE = 20;
const TRENDING_COUNT = 6;
const TRENDING_WINDOW_DAYS = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseSearchParams(params);
  const offset = query.offset ?? 0;
  const isLanding = Object.values(params).every((v) => !v);
  const [{ items, total }, trending] = await Promise.all([
    searchTournaments({ ...query, limit: PAGE_SIZE, offset }),
    // Landing page: upcoming events in the next two months, ranked by popularity.
    isLanding
      ? searchTournaments({
          sort: "popular",
          to: new Date(Date.now() + TRENDING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10),
          limit: TRENDING_COUNT,
        })
      : null,
  ]);

  const pageHref = (newOffset: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "offset") sp.set(k, v);
    if (newOffset) sp.set("offset", String(newOffset));
    return `/?${sp}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Find poker tournaments</h1>
          <p className="text-sm text-muted">Live and online events worldwide, by location, buy-in, game and date.</p>
        </div>
        <Filters query={query} />
        {trending && trending.items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Trending now</h2>
              <Link href="/?sort=popular" className="text-sm text-accent">
                See all popular →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {trending.items.map((t) => (
                <TournamentCard key={t.id} t={t} compact />
              ))}
            </div>
            <h2 className="pt-2 text-lg font-semibold">Upcoming</h2>
          </div>
        )}
        <p className="text-sm text-muted">
          {total} tournament{total === 1 ? "" : "s"}
        </p>
        <div className="grid gap-3">
          {items.map((t) => (
            <TournamentCard key={t.id} t={t} />
          ))}
          {items.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              No tournaments match these filters. Try removing some, or ask the assistant.
            </p>
          )}
        </div>
        {total > PAGE_SIZE && (
          <div className="flex justify-between text-sm">
            {offset > 0 ? <Link href={pageHref(Math.max(0, offset - PAGE_SIZE))}>← Previous</Link> : <span />}
            {offset + PAGE_SIZE < total ? <Link href={pageHref(offset + PAGE_SIZE)}>Next →</Link> : <span />}
          </div>
        )}
      </section>
      <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
        <Chat
          title="Ask about tournaments"
          placeholder="e.g. PLO events in Europe under $1,500 next month"
          suggestions={["Biggest guarantees this month", "Online bounty events under $200", "Live events in Las Vegas"]}
        />
      </aside>
    </div>
  );
}
