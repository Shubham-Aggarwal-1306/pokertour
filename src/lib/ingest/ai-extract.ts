import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { FORMATS, GAME_TYPES } from "@/lib/types";
import type { Draft } from "./normalize";

const ExtractedSchema = z.object({
  tournaments: z.array(
    z.object({
      name: z.string(),
      series: z.string().nullable(),
      startDate: z.string().describe("ISO 8601; date only if time unknown"),
      endDate: z.string().nullable(),
      online: z.boolean(),
      platform: z.string().nullable(),
      venue: z.string().nullable(),
      city: z.string().nullable(),
      country: z.string().nullable(),
      buyIn: z.number().nullable(),
      currency: z.string().nullable().describe("ISO 4217 code"),
      guaranteeUsd: z.number().nullable(),
      game: z.enum(GAME_TYPES),
      formats: z.array(z.enum(FORMATS)),
      startingStack: z.number().nullable(),
      blindLevelMinutes: z.number().nullable(),
      lateRegistration: z.string().nullable(),
    }),
  ),
});

/** Strip markup so we pay for page text only, not HTML/CSS/JS. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * Fallback extractor for schedule pages without structured data. Costs tokens,
 * so it only runs for sources marked `ai: true` and only when the page changed.
 */
export async function extractWithAi(html: string, pageUrl: string): Promise<Draft[]> {
  const maxChars = Number(process.env.INGEST_AI_MAX_CHARS) || 24_000;
  const text = htmlToText(html).slice(0, maxChars);
  if (!text) return [];

  const model = new ChatAnthropic({
    model: process.env.INGEST_MODEL || "claude-haiku-4-5",
    maxTokens: 8000,
    maxRetries: 2,
  }).withStructuredOutput(ExtractedSchema, { name: "extract_tournaments" });

  const result = await model.invoke([
    {
      role: "system",
      content:
        "Extract every poker tournament listed on the page. Use only facts on the page; use null when unknown. Skip cash games and non-poker events. Return an empty list if none.",
    },
    { role: "user", content: `URL: ${pageUrl}\n\n${text}` },
  ]);
  return result.tournaments;
}
