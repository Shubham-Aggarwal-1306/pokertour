import { getStore } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tournament = await getStore().get(id);
  if (!tournament) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(tournament, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
