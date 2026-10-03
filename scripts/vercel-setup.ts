import { getDatabaseUrl } from "../src/lib/db-url";
import { migrate, seed } from "./db";

/**
 * Runs during every Vercel build (see vercel.json buildCommand) with the
 * project's own environment variables, so no secrets ever need to live on a
 * developer machine. Without a database it does nothing and the app serves demo data.
 */
async function main() {
  if (!getDatabaseUrl()) {
    console.log("[setup] No database connected; skipping migrations (demo data mode).");
    return;
  }
  await migrate();
  if (process.env.SEED_DEMO_DATA === "true") await seed();
}

main().catch((err) => {
  console.error("[setup] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
