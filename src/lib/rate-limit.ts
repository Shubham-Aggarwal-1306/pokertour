const hits = new Map<string, number[]>();

/**
 * Best-effort sliding-window limiter. State is per serverless instance, so it
 * stops casual abuse but is not a hard global cap; back it with Upstash/Vercel KV
 * if the chat starts getting hammered.
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear();
  return true;
}
