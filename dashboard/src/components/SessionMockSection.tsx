"use client";

import { useCallback, useState } from "react";
import { SessionCard } from "@/components/SessionCard";
import type { TranscriptLine } from "@/types/session";

const initialPhone: TranscriptLine[] = [
  {
    role: "caller",
    content: "Hey can you check where we're at on the capstone?",
  },
  {
    role: "agent",
    content: "Yeah for sure, let me pull that up...",
  },
];

const initialMeeting: TranscriptLine[] = [
  {
    role: "participant",
    content: "Lucas, what did you work on yesterday?",
    speaker: "Jake",
  },
  {
    role: "agent",
    content: "I pushed the auth middleware and fixed that CORS bug",
  },
];

/** Mock data so hour 0.5 components are visible before Socket.IO wiring (hour 2). */
export function SessionMockSection() {
  const [phoneLines, setPhoneLines] = useState(initialPhone);

  const appendPhoneLine = useCallback(() => {
    setPhoneLines((prev) => [
      ...prev,
      {
        role: "caller",
        content: `Extra line ${prev.length + 1} — transcript should scroll to bottom.`,
      },
    ]);
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="w-full text-center text-xs text-zinc-500 dark:text-zinc-400">
        Hour 0.5 — SessionCard / LiveTranscript / StatusBadge (mock data)
      </p>
      <SessionCard
        variant="phone"
        status="active"
        subtitle="+1 (555) 010-4242"
        messages={phoneLines}
        actionLabel="End Call"
        onAction={() => {}}
      />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={appendPhoneLine}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Add phone line (scroll test)
        </button>
      </div>
      <SessionCard
        variant="meeting"
        status="joining"
        subtitle="https://meet.google.com/abc-defg-hij"
        messages={initialMeeting}
        actionLabel="Leave Meeting"
        onAction={() => {}}
      />
    </div>
  );
}
