"use client";

import { useSocket } from "@/hooks/useSocket";
import { SessionCard } from "@/components/SessionCard";
import { JoinMeetingPanel } from "@/components/JoinMeetingPanel";

export function ActiveSessionsSection() {
  const {
    activeCall,
    activeMeeting,
    endCall,
    leaveMeeting,
    joinMeeting,
    connected,
  } = useSocket();

  const meetingColumnClass =
    activeCall === null ? "md:col-span-2" : undefined;

  return (
    <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2">
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
      <div className={meetingColumnClass}>
        {activeMeeting !== null ? (
          <SessionCard
            variant="meeting"
            status={activeMeeting.status}
            subtitle={activeMeeting.meetingUrl}
            messages={activeMeeting.transcript}
            actionLabel="Leave Meeting"
            onAction={leaveMeeting}
          />
        ) : (
          <JoinMeetingPanel
            onJoin={joinMeeting}
            disabled={!connected}
          />
        )}
      </div>
    </div>
  );
}
