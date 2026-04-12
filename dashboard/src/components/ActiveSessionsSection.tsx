"use client";

import { useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/useToast";
import { SessionCard } from "@/components/SessionCard";
import { JoinMeetingPanel } from "@/components/JoinMeetingPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { ToastContainer } from "@/components/Toast";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

export function ActiveSessionsSection() {
  const {
    activeCall,
    activeMeeting,
    endCall,
    leaveMeeting,
    joinMeeting,
    connected,
  } = useSocket();

  const { toasts, show } = useToast();
  const [confirmAction, setConfirmAction] = useState<
    "endCall" | "leaveMeeting" | null
  >(null);

  function handleConfirm() {
    if (confirmAction === "endCall") {
      endCall();
      show("Call ended");
    } else if (confirmAction === "leaveMeeting") {
      leaveMeeting();
      show("Left meeting");
    }
    setConfirmAction(null);
  }

  const isEmpty = activeCall === null && activeMeeting === null;

  const meetingColumnClass =
    !isEmpty && activeCall === null ? "md:col-span-2" : undefined;

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2">
        {isEmpty ? (
          <EmptyState />
        ) : (
          activeCall !== null && (
            <SessionCard
              variant="phone"
              status={activeCall.status}
              subtitle={formatPhone(activeCall.callerNumber)}
              messages={activeCall.transcript}
              startedAt={activeCall.startedAt}
              actionLabel="End Call"
              onAction={() => setConfirmAction("endCall")}
            />
          )
        )}
        <div className={meetingColumnClass}>
          {activeMeeting !== null ? (
            <SessionCard
              variant="meeting"
              status={activeMeeting.status}
              subtitle={activeMeeting.meetingUrl}
              messages={activeMeeting.transcript}
              startedAt={activeMeeting.startedAt}
              actionLabel="Leave Meeting"
              onAction={() => setConfirmAction("leaveMeeting")}
            />
          ) : (
            <JoinMeetingPanel
              onJoin={(url) => {
                joinMeeting(url);
                show("Joining meeting...");
              }}
              disabled={!connected}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction === "endCall" ? "End this call?" : "Leave this meeting?"
        }
        description={
          confirmAction === "endCall"
            ? "The agent will disconnect from the call. This cannot be undone."
            : "The agent will leave the meeting. You can rejoin later with a new link."
        }
        confirmLabel={
          confirmAction === "endCall" ? "End Call" : "Leave Meeting"
        }
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <ToastContainer toasts={toasts} />
    </>
  );
}
