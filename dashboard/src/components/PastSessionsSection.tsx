"use client";

import { useState } from "react";
import { Phone, Video, ChevronDown, ChevronUp } from "lucide-react";
import { LiveTranscript } from "@/components/LiveTranscript";
import type { PastSession } from "@/hooks/usePastSessions";

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function PastSessionCard({ session }: { session: PastSession }) {
  const [expanded, setExpanded] = useState(false);
  const isPhone = session.type === "phone";
  const Icon = isPhone ? Phone : Video;
  const label = isPhone ? "Phone" : "Meeting";
  const subtitle = isPhone
    ? session.caller_number ?? "unknown"
    : session.meeting_url ?? "";
  const iconColor = isPhone ? "text-accent-phone" : "text-accent-meeting";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--input-bg)]"
      >
        <Icon size={15} className={iconColor} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <span className="text-[10px] text-subtle">
              {formatDate(session.ended_at)}
            </span>
          </div>
          {subtitle && (
            <p className="mt-0.5 truncate font-mono text-xs text-subtle" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatDuration(session.started_at, session.ended_at)}
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-subtle" />
        ) : (
          <ChevronDown size={14} className="text-subtle" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-header-border px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
            Transcript
          </p>
          <LiveTranscript
            messages={session.transcript.map((t) => ({
              role: t.role,
              content: t.content,
              speaker: t.speaker,
              timestamp: t.timestamp,
            }))}
            emptyLabel="No transcript recorded."
          />
        </div>
      )}
    </div>
  );
}

export function PastSessionsSection({ sessions }: { sessions: PastSession[] }) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No past sessions yet. Completed calls and meetings will appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map((s) => (
        <PastSessionCard key={s.id} session={s} />
      ))}
    </div>
  );
}
