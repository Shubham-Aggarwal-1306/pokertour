import { searchTournaments } from "@/lib/search";
import { parseSearchParams } from "@/lib/search-params";

export async function GET(req: Request) {
  const query = parseSearchParams(new URL(req.url).searchParams);
  const result = await searchTournaments(query);
  return Response.json(result, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
