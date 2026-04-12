"use client";

import { usePastSessions } from "@/hooks/usePastSessions";
import { PastSessionsSection } from "@/components/PastSessionsSection";
import { useSocket } from "@/hooks/useSocket";
import { useEffect } from "react";

export function PastSessionsWrapper() {
  const { sessions, loading, refresh, prepend } = usePastSessions();
  const { lastEndedSession, clearLastEndedSession } = useSocket();

  useEffect(() => {
    if (!lastEndedSession) return;

    // Optimistically add to the list immediately
    prepend(lastEndedSession);
    clearLastEndedSession();

    // Background refresh to sync with server data
    const timer = setTimeout(refresh, 2000);
    return () => clearTimeout(timer);
  }, [lastEndedSession, prepend, clearLastEndedSession, refresh]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading past sessions...</p>
    );
  }

  return <PastSessionsSection sessions={sessions} />;
}
