"use client";

import { usePastSessions } from "@/hooks/usePastSessions";
import { PastSessionsSection } from "@/components/PastSessionsSection";
import { useSocket } from "@/hooks/useSocket";
import { useEffect, useRef } from "react";

export function PastSessionsWrapper() {
  const { sessions, loading, refresh } = usePastSessions();
  const { activeCall, activeMeeting } = useSocket();

  // Refresh when a call/meeting ends (goes from non-null to null)
  const prevCall = useRef(activeCall);
  const prevMeeting = useRef(activeMeeting);

  useEffect(() => {
    const callEnded = prevCall.current !== null && activeCall === null;
    const meetingEnded = prevMeeting.current !== null && activeMeeting === null;
    prevCall.current = activeCall;
    prevMeeting.current = activeMeeting;

    if (callEnded || meetingEnded) {
      // Small delay to let the server save first
      const timer = setTimeout(refresh, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeCall, activeMeeting, refresh]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading past sessions...</p>
    );
  }

  return <PastSessionsSection sessions={sessions} />;
}
