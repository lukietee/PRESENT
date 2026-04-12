"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/types/session";

export function lineLabel(line: TranscriptLine): string {
  if (line.speaker?.trim()) {
    return line.speaker.trim();
  }
  const r = line.role.toLowerCase();
  if (r === "agent") return "You (AI)";
  if (r === "caller") return "Caller";
  return line.role.charAt(0).toUpperCase() + line.role.slice(1);
}

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
        "min-h-[5rem] max-h-[70vh] overflow-y-auto space-y-2 px-1 py-1",
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
          const isTool = line.role.toLowerCase() === "tool";

          if (isTool) {
            return (
              <div key={i} className="flex justify-center">
                <div className="max-w-full overflow-hidden rounded-lg px-3 py-1 text-xs font-mono bg-amber-950/40 text-amber-300 border border-amber-800/30">
                  <span className="break-all">{line.content}</span>
                  {line.timestamp && (
                    <span className="ml-2 font-sans text-[10px] text-amber-300/50 whitespace-nowrap">
                      {formatTime(line.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={i}
              className={`flex flex-col gap-0.5 ${isAgent ? "items-end" : "items-start"}`}
            >
              <span
                className={`px-1 text-[10px] font-medium ${isAgent ? "text-bubble-label-agent" : "text-bubble-label-caller"}`}
              >
                {lineLabel(line)}
                {line.timestamp && (
                  <span className="ml-1.5 font-normal text-subtle">
                    {formatTime(line.timestamp)}
                  </span>
                )}
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
