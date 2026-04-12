"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/types/session";

function lineLabel(line: TranscriptLine): string {
  const r = line.role.toLowerCase();
  const rolePart =
    r === "caller"
      ? "Caller:"
      : r === "agent"
        ? "You (AI):"
        : `${line.role.charAt(0).toUpperCase()}${line.role.slice(1)}:`;

  if (line.speaker?.trim()) {
    return `${line.speaker.trim()} — ${rolePart}`;
  }
  return rolePart;
}

export type LiveTranscriptProps = {
  messages: TranscriptLine[];
  className?: string;
  /** Shown when `messages` is empty */
  emptyLabel?: string;
};

export function LiveTranscript({
  messages,
  className,
  emptyLabel = "No messages yet.",
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <section
      className={[
        "w-full max-w-xl rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left dark:border-zinc-800 dark:bg-zinc-950",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Live transcript
      </h2>
      <div
        ref={scrollRef}
        className="mt-3 min-h-[4rem] max-h-48 overflow-y-auto rounded-lg border border-zinc-200/80 bg-white/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((line, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  {lineLabel(line)}{" "}
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">{line.content}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
