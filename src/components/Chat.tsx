"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ChatEvent } from "@/lib/ai/chat";
import type { Tournament } from "@/lib/types";
import { TournamentCard } from "./TournamentCard";

type UiMessage = { role: "user" | "assistant"; content: string; tournaments?: Tournament[]; error?: boolean };

const MAX_INPUT = 500;

/** Render **bold** and [text](/internal-link) from the assistant's markdown-lite output. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const href = link[2];
          return href.startsWith("/") ? (
            <Link key={i} href={href} className="text-accent underline">
              {link[1]}
            </Link>
          ) : (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline">
              {link[1]}
            </a>
          );
        }
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        return bold ? <strong key={i}>{bold[1]}</strong> : <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function Chat({
  title,
  placeholder,
  suggestions = [],
  tournamentId,
}: {
  title: string;
  placeholder: string;
  suggestions?: string[];
  tournamentId?: string;
}) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_INPUT);
    if (!content || busy) return;
    const history: UiMessage[] = [...messages.filter((m) => !m.error), { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    scrollDown();

    const update = (fn: (m: UiMessage) => UiMessage) =>
      setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          tournamentId,
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "The assistant is unavailable right now.");
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ChatEvent;
          if (event.type === "text") {
            setStatus(null);
            update((m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === "status") {
            setStatus(event.text);
          } else if (event.type === "tournaments") {
            update((m) => {
              const seen = new Set((m.tournaments ?? []).map((t) => t.id));
              return { ...m, tournaments: [...(m.tournaments ?? []), ...event.items.filter((t) => !seen.has(t.id))] };
            });
          } else if (event.type === "error") {
            update((m) => ({ ...m, content: m.content || event.message, error: true }));
          }
          scrollDown();
        }
      }
    } catch (err) {
      update((m) => ({ ...m, content: err instanceof Error ? err.message : "Something went wrong.", error: true }));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        <p className="text-xs text-muted">AI answers can be wrong — confirm details with the organizer.</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl bg-accent px-3 py-2 text-sm text-accent-contrast">{m.content}</div>
            ) : (
              <div className="space-y-2">
                <div className={`whitespace-pre-wrap text-sm leading-relaxed ${m.error ? "text-red-500" : ""}`}>
                  {m.content ? <RichText text={m.content} /> : busy && i === messages.length - 1 ? (status ?? "Thinking…") : null}
                </div>
                {m.tournaments && m.tournaments.length > 0 && (
                  <div className="space-y-2">
                    {m.tournaments.slice(0, 5).map((t) => (
                      <TournamentCard key={t.id} t={t} compact />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          maxLength={MAX_INPUT}
          className="input"
          aria-label="Message"
        />
        <button className="btn" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
