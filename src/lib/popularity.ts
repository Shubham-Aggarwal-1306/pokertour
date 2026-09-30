import type { Tournament } from "@/lib/types";

/**
 * Popularity = recent user engagement (time-decayed) + a small prior from the
 * prize pool, so brand-new events with no traffic yet still rank sensibly.
 *
 *   engagement = Σ over the last WINDOW_DAYS of
 *                (views·1 + clicks·3 + chats·2) · 0.5^(ageDays / HALF_LIFE_DAYS)
 *   prior      = PRIOR_WEIGHT · log10(1 + guaranteeUsd / 1000)   ($1M GTD ≈ 6)
 *
 * The Postgres store computes the same formula in SQL; keep the two in sync.
 */
export const ENGAGEMENT_WEIGHTS = { view: 1, click: 3, chat: 2 } as const;
export const HALF_LIFE_DAYS = 7;
export const WINDOW_DAYS = 30;
export const PRIOR_WEIGHT = 2;

export type EngagementKind = keyof typeof ENGAGEMENT_WEIGHTS;
export const ENGAGEMENT_KINDS = Object.keys(ENGAGEMENT_WEIGHTS) as EngagementKind[];

export interface DailyEngagement {
  day: string; // YYYY-MM-DD
  views: number;
  clicks: number;
  chats: number;
}

export function popularityPrior(t: Pick<Tournament, "guaranteeUsd">): number {
  return PRIOR_WEIGHT * Math.log10(1 + (t.guaranteeUsd ?? 0) / 1000);
}

export function engagementScore(days: DailyEngagement[], today = new Date()): number {
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let score = 0;
  for (const d of days) {
    const age = (todayMs - Date.parse(`${d.day}T00:00:00Z`)) / 86_400_000;
    if (age < 0 || age >= WINDOW_DAYS) continue;
    const raw =
      d.views * ENGAGEMENT_WEIGHTS.view + d.clicks * ENGAGEMENT_WEIGHTS.click + d.chats * ENGAGEMENT_WEIGHTS.chat;
    score += raw * 0.5 ** (age / HALF_LIFE_DAYS);
  }
  return score;
}

/** SQL expression for the same score; expects the tournaments row aliased as `t`. */
export const POPULARITY_SQL = `(
  coalesce((
    SELECT sum(
      (e.views * ${ENGAGEMENT_WEIGHTS.view} + e.clicks * ${ENGAGEMENT_WEIGHTS.click} + e.chats * ${ENGAGEMENT_WEIGHTS.chat})
      * power(0.5, (current_date - e.day) / ${HALF_LIFE_DAYS}.0)
    )
    FROM tournament_engagement e
    WHERE e.tournament_id = t.id AND e.day > current_date - ${WINDOW_DAYS}
  ), 0)
  + ${PRIOR_WEIGHT} * log(1 + coalesce(t.guarantee_usd, 0) / 1000.0)
)`;
