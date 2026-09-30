import { indexTournaments } from "../src/lib/rag";
import { getStore } from "../src/lib/store";

async function main() {
  // Re-embeds every stored tournament. Run after changing VOYAGE_MODEL or the embedded text format.
  const { items } = await getStore().search({ from: "1970-01-01", limit: 100_000 });
  const embedded = await indexTournaments(items);
  console.log(`Embedded ${embedded} of ${items.length} tournaments.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
