"use client";

import { useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/useToast";
import { SessionCard } from "@/components/SessionCard";
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
    endCall,
    connected,
    approveTool,
    denyTool,
  } = useSocket();

  const { toasts, show } = useToast();
  const [confirmAction, setConfirmAction] = useState<"endCall" | null>(null);

  function handleConfirm() {
    if (confirmAction === "endCall") {
      endCall();
      show("Call ended");
    }
    setConfirmAction(null);
  }

  return (
    <>
      {activeCall !== null ? (
        <SessionCard
          variant="phone"
          status={activeCall.status}
          subtitle={formatPhone(activeCall.callerNumber)}
          messages={activeCall.transcript}
          startedAt={activeCall.startedAt}
          actionLabel="End Call"
          onAction={() => setConfirmAction("endCall")}
          onApproveTool={approveTool}
          onDenyTool={denyTool}
        />
      ) : (
        <EmptyState />
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        title="End this call?"
        description="The agent will disconnect from the call. This cannot be undone."
        confirmLabel="End Call"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <ToastContainer toasts={toasts} />
    </>
  );
}
