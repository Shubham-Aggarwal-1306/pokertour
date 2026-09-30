import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PokerTour — find poker tournaments worldwide",
  description:
    "Search live and online poker tournaments around the world by location, buy-in, game and date, and ask the AI assistant about any event.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold">
              ♠ PokerTour
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/">Search</Link>
              <Link href="/?sort=popular">Popular</Link>
              <Link href="/chat">Ask AI</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
          Tournament details change often — always confirm with the organizer before travelling or registering.
        </footer>
      </body>
    </html>
  );
}
