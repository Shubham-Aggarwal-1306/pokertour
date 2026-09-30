/**
 * Cost controls for the public chat. All values can be overridden via env vars
 * so they can be tuned on Vercel without a redeploy of code.
 */
const int = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};

export const chatConfig = {
  /** Cheapest current Claude model by default; set ANTHROPIC_MODEL to upgrade. */
  model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
  /** Cap on the answer length. Short answers keep output-token spend low. */
  maxOutputTokens: int("CHAT_MAX_OUTPUT_TOKENS", 700),
  /** Max characters in a single user message. */
  maxInputChars: int("CHAT_MAX_INPUT_CHARS", 500),
  /** Only the last N messages of history are sent to the model. */
  historyWindow: int("CHAT_HISTORY_WINDOW", 6),
  /** Each past message is truncated to this many characters before resending. */
  historyMessageChars: int("CHAT_HISTORY_MESSAGE_CHARS", 1200),
  /** Max tool-call rounds per user message before the model must answer. */
  maxToolRounds: int("CHAT_MAX_TOOL_ROUNDS", 3),
  /** Results returned to the model per search call. */
  searchResultLimit: int("CHAT_SEARCH_RESULT_LIMIT", 8),
  /** Requests per IP per minute (per serverless instance; use a shared store for strict limits). */
  rateLimitPerMinute: int("CHAT_RATE_LIMIT_PER_MINUTE", 8),
};
