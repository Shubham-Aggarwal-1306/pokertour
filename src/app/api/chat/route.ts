import { ChatRequestSchema, runChat, type ChatEvent } from "@/lib/ai/chat";
import { chatConfig } from "@/lib/ai/config";
import { tournamentDetail } from "@/lib/ai/format";
import { recordEngagement } from "@/lib/engagement";
import { rateLimit } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const json = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, "Chat is not configured (ANTHROPIC_API_KEY missing).");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`chat:${ip}`, chatConfig.rateLimitPerMinute)) {
    return json(429, "Too many messages. Please wait a minute and try again.");
  }

  const parsed = ChatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, "Invalid request.");
  const { messages, tournamentId } = parsed.data;

  const latest = messages[messages.length - 1];
  if (latest.role !== "user" || !latest.content.trim()) return json(400, "Last message must be from the user.");
  if (latest.content.length > chatConfig.maxInputChars) {
    return json(400, `Please keep messages under ${chatConfig.maxInputChars} characters.`);
  }

  const tournament = tournamentId ? await getStore().get(tournamentId) : null;
  if (tournament) recordEngagement(tournament.id, "chat", ip);

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const event of runChat(messages, {
          tournamentDetail: tournament ? tournamentDetail(tournament) : undefined,
          signal: req.signal,
        })) {
          send(event);
        }
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (req.signal.aborted) {
          // client went away; nothing to report
        } else if (status === 429 || status === 529) {
          send({ type: "error", message: "The assistant is busy right now. Please try again shortly." });
        } else {
          console.error("chat failed", err);
          send({ type: "error", message: "Something went wrong. Please try again." });
        }
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
