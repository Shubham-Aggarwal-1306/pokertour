import type { EngagementKind } from "@/lib/popularity";
import { rateLimit } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|monitor|headless/i;

export function isLikelyBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

/**
 * Fire-and-forget popularity signal. When a client key (IP) is given, each
 * client counts at most once per tournament per kind every 6 hours, so refreshes
 * and simple scripts can't inflate rankings. Never throws.
 */
export function recordEngagement(tournamentId: string, kind: EngagementKind, clientKey?: string): void {
  if (clientKey && !rateLimit(`eng:${kind}:${tournamentId}:${clientKey}`, 1, 6 * 3_600_000)) return;
  getStore()
    .recordEngagement(tournamentId, kind)
    .catch((err) => console.error("recordEngagement failed", err));
}
