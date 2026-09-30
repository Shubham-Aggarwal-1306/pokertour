import { buildSampleTournaments } from "../src/lib/data/sample";
import { indexTournaments } from "../src/lib/rag";
import { getStore } from "../src/lib/store";

async function main() {
  // Loads the fictional demo tournaments into the database and embeds them.
  const tournaments = buildSampleTournaments();
  await getStore().upsert(tournaments);
  const embedded = await indexTournaments(tournaments);
  console.log(`Seeded ${tournaments.length} demo tournaments (${embedded} embedded).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
