import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, HumanMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { createAgent, modelCallLimitMiddleware } from "langchain";
import { z } from "zod";
import type { Tournament } from "@/lib/types";
import { chatConfig } from "./config";
import { contextBlock, SYSTEM_PROMPT } from "./prompt";
import { TOOLS } from "./tools";

export const ChatRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .min(1)
    .max(50),
  tournamentId: z.string().max(200).optional(),
});

export type ChatMessage = z.infer<typeof ChatRequestSchema>["messages"][number];

/** Events streamed to the browser as newline-delimited JSON. */
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "status"; text: string }
  | { type: "tournaments"; items: Tournament[] }
  | { type: "error"; message: string }
  | { type: "done" };

let model: BaseChatModel | undefined;
function getModel(): BaseChatModel {
  model ??= new ChatAnthropic({
    model: chatConfig.model,
    maxTokens: chatConfig.maxOutputTokens,
    streaming: true,
    maxRetries: 1,
  });
  return model;
}

/**
 * Keep only the recent window of text history, trimmed, starting with a user
 * turn. Past tool calls are not replayed: their results were already summarised
 * in the assistant's text, and resending them would multiply input tokens.
 */
export function trimHistory(messages: ChatMessage[]): BaseMessage[] {
  const recent = messages.slice(-chatConfig.historyWindow);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent.map((m, i) => {
    const limit = i === recent.length - 1 ? chatConfig.maxInputChars : chatConfig.historyMessageChars;
    const content = m.content.slice(0, limit);
    return m.role === "user" ? new HumanMessage(content) : new AIMessage(content);
  });
}

/**
 * Retrieval-augmented chat: a LangChain agent whose tools retrieve tournaments
 * from the hybrid (pgvector + keyword) index, so answers are grounded in stored
 * records rather than the model's memory.
 */
export async function* runChat(
  messages: ChatMessage[],
  opts: { tournamentDetail?: string; signal?: AbortSignal; model?: BaseChatModel } = {},
): AsyncGenerator<ChatEvent> {
  const agent = createAgent({
    model: opts.model ?? getModel(),
    tools: TOOLS,
    systemPrompt: `${SYSTEM_PROMPT}\n\n${contextBlock(new Date().toISOString().slice(0, 10), opts.tournamentDetail)}`,
    // Hard cap on model calls per question (tool rounds + final answer) to bound cost.
    middleware: [modelCallLimitMiddleware({ runLimit: chatConfig.maxToolRounds + 1, exitBehavior: "end" })],
  });

  const stream = await agent.stream(
    { messages: trimHistory(messages) },
    { streamMode: "messages", signal: opts.signal },
  );

  let announcedSearch = false;
  for await (const [message] of stream) {
    if (AIMessageChunk.isInstance(message)) {
      if (message.tool_call_chunks?.length && !announcedSearch) {
        announcedSearch = true;
        yield { type: "status", text: "Searching tournaments…" };
      }
      if (message.text) yield { type: "text", text: message.text };
    } else if (ToolMessage.isInstance(message)) {
      announcedSearch = false;
      const items = message.artifact as Tournament[] | undefined;
      if (items?.length) yield { type: "tournaments", items };
    }
  }
}
