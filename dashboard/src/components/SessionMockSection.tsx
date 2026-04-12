"use client";

import { useCallback, useState } from "react";
import { SessionCard } from "@/components/SessionCard";
import {
  initialMockActiveCall,
  initialMockActiveMeeting,
  mockCallToSessionCardFields,
  mockMeetingToSessionCardFields,
} from "@/lib/mockSessions";
import type { TranscriptLine } from "@/types/session";

const btnClass =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900";

/** Hour 1.5: mock active call + meeting cards; swap for useSocket state in hour 2. */
export function SessionMockSection() {
  const [phoneLines, setPhoneLines] = useState<TranscriptLine[]>(() => [
    ...initialMockActiveCall.transcript,
  ]);
  const [meetingLines, setMeetingLines] = useState<TranscriptLine[]>(() => [
    ...initialMockActiveMeeting.transcript,
  ]);

  const appendPhoneLine = useCallback(() => {
    setPhoneLines((prev) => [
      ...prev,
      {
        role: "caller",
        content: `Extra line ${prev.length + 1} — transcript should scroll to bottom.`,
      },
    ]);
  }, []);

  const appendMeetingLine = useCallback(() => {
    setMeetingLines((prev) => [
      ...prev,
      {
        role: "participant",
        content: `Extra line ${prev.length + 1} — transcript should scroll to bottom.`,
        speaker: "Jake",
      },
    ]);
  }, []);

  const phoneFields = mockCallToSessionCardFields({
    ...initialMockActiveCall,
    transcript: phoneLines,
  });
  const meetingFields = mockMeetingToSessionCardFields({
    ...initialMockActiveMeeting,
    transcript: meetingLines,
  });

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="w-full text-center text-xs text-zinc-500 dark:text-zinc-400">
        Mock payloads match architecture/07-api-contract.md until live Socket.IO events.
      </p>
      <SessionCard
        variant="phone"
        status={phoneFields.status}
        subtitle={phoneFields.subtitle}
        messages={phoneFields.messages}
        actionLabel="End Call"
        onAction={() => {}}
      />
      <div className="flex justify-center">
        <button type="button" onClick={appendPhoneLine} className={btnClass}>
          Add phone line (scroll test)
        </button>
      </div>
      <SessionCard
        variant="meeting"
        status={meetingFields.status}
        subtitle={meetingFields.subtitle}
        messages={meetingFields.messages}
        actionLabel="Leave Meeting"
        onAction={() => {}}
      />
      <div className="flex justify-center">
        <button type="button" onClick={appendMeetingLine} className={btnClass}>
          Add meeting line (scroll test)
        </button>
      </div>
    </div>
  );
}
