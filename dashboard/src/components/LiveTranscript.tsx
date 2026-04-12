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
    <div
      ref={scrollRef}
      className={[
        "min-h-[5rem] max-h-52 overflow-y-auto space-y-2 px-1 py-1 sm:max-h-60 md:max-h-52",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        messages.map((line, i) => {
          const isAgent = line.role.toLowerCase() === "agent";
          return (
            <div
              key={i}
              className={`flex flex-col gap-0.5 ${isAgent ? "items-end" : "items-start"}`}
            >
              <span
                className={`px-1 text-[10px] font-medium ${isAgent ? "text-bubble-label-agent" : "text-bubble-label-caller"}`}
              >
                {lineLabel(line)}
              </span>
              <div
                className={`max-w-[min(85%,20rem)] rounded-xl px-3 py-1.5 text-sm leading-relaxed sm:max-w-[85%] ${
                  isAgent
                    ? "rounded-tr-sm bg-bubble-agent-bg text-bubble-agent-text"
                    : "rounded-tl-sm bg-bubble-caller-bg text-bubble-caller-text"
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
