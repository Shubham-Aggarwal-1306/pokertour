/**
 * Postgres connection string from the environment. Vercel's Neon integration
 * sets DATABASE_URL and POSTGRES_URL, or prefixed names (e.g. STORAGE_DATABASE_URL)
 * when a custom prefix was chosen, so accept any of them.
 */
export function getDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  const prefixed = Object.keys(env)
    .filter((k) => /_(DATABASE_URL|POSTGRES_URL)$/.test(k) && env[k])
    .sort();
  return prefixed.length ? env[prefixed[0]] : undefined;
}

export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "No database URL found (DATABASE_URL / POSTGRES_URL). Connect Neon to the Vercel project for this environment, " +
        "then run the script through `vercel env run -e production -- …` (the npm db:* scripts do this).",
    );
  }
  return url;
}
