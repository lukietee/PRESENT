"use client";

import { useCallback, useEffect, useState } from "react";

export type PastSession = {
  id: string;
  type: "phone" | "meeting";
  caller_number?: string;
  meeting_url?: string;
  transcript: { role: string; content: string; speaker?: string; timestamp?: string }[];
  started_at: string;
  ended_at: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export function usePastSessions() {
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // silently fail — server may not be up
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const prepend = useCallback((session: PastSession) => {
    setSessions((prev) => {
      if (prev.some((s) => s.id === session.id)) return prev;
      return [session, ...prev];
    });
  }, []);

  return { sessions, loading, refresh, prepend };
}
