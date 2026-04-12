"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/types/session";

function lineLabel(line: TranscriptLine): string {
  if (line.speaker?.trim()) {
    return line.speaker.trim();
  }
  const r = line.role.toLowerCase();
  if (r === "agent") return "You (AI)";
  if (r === "caller") return "Caller";
  return line.role.charAt(0).toUpperCase() + line.role.slice(1);
}

export type LiveTranscriptProps = {
  messages: TranscriptLine[];
  className?: string;
  emptyLabel?: string;
};

export function LiveTranscript({
  messages,
  emptyLabel = "No messages yet.",
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={scrollRef}
      className="min-h-[5rem] max-h-[70vh] overflow-y-auto space-y-2 px-1 py-1"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500 px-2">{emptyLabel}</p>
      ) : (
        messages.map((line, i) => {
          const isAgent = line.role.toLowerCase() === "agent";
          return (
            <div
              key={i}
              className={`flex flex-col gap-0.5 ${isAgent ? "items-end" : "items-start"}`}
            >
              <span className={`text-[10px] font-medium px-1 ${isAgent ? "text-emerald-500" : "text-zinc-500"}`}>
                {lineLabel(line)}
              </span>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm leading-relaxed ${
                  isAgent
                    ? "bg-emerald-950/60 text-emerald-100 rounded-tr-sm"
                    : "bg-zinc-700/50 text-zinc-200 rounded-tl-sm"
                }`}
              >
                {line.content}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
