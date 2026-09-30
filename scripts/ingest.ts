import { runIngest } from "../src/lib/ingest/run";

async function main() {
  const reports = await runIngest({ force: process.argv.includes("--force") });
  console.table(reports);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
