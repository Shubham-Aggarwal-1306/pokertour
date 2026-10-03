import { seed } from "./db";

seed().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
