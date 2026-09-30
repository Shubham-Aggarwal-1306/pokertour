import { isLikelyBot, recordEngagement } from "@/lib/engagement";
import { ENGAGEMENT_KINDS, type EngagementKind } from "@/lib/popularity";

/** Receives view / outbound-click beacons from tournament pages. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const kind = new URL(req.url).searchParams.get("kind") as EngagementKind;
  // Chat engagement is recorded server-side only.
  if (!ENGAGEMENT_KINDS.includes(kind) || kind === "chat") return new Response(null, { status: 400 });
  if (!isLikelyBot(req.headers.get("user-agent"))) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    recordEngagement(id, kind, ip);
  }
  return new Response(null, { status: 204 });
}
