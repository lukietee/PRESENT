"use client";

import { Radio } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { SessionCard } from "@/components/SessionCard";

export function ActiveSessionsSection() {
  const { activeCall, activeMeeting, endCall, leaveMeeting } = useSocket();

  const hasActiveSessions = activeCall !== null || activeMeeting !== null;

  if (!hasActiveSessions) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-700/40 bg-zinc-800/30 py-20 text-center">
        <Radio size={20} className="text-zinc-600" strokeWidth={1.5} />
        <p className="text-sm text-zinc-500">No active sessions</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {activeCall !== null && (
        <SessionCard
          variant="phone"
          status={activeCall.status}
          subtitle={activeCall.callerNumber}
          messages={activeCall.transcript}
          actionLabel="End Call"
          onAction={endCall}
        />
      )}
      {activeMeeting !== null && (
        <SessionCard
          variant="meeting"
          status={activeMeeting.status}
          subtitle={activeMeeting.meetingUrl}
          messages={activeMeeting.transcript}
          actionLabel="Leave Meeting"
          onAction={leaveMeeting}
        />
      )}
    </div>
  );
}
