"use client";

import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import type {
  TranscriptLine,
  PhoneSessionStatus,
  MeetingSessionStatus,
} from "@/types/session";
import type { PastSession } from "@/hooks/usePastSessions";

const url =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export type Hour0TestPayload = {
  message: string;
  at: string;
};

export type ActiveCall = {
  id: string;
  callerNumber: string;
  transcript: TranscriptLine[];
  status: PhoneSessionStatus;
  startedAt: number;
};

export type ActiveMeeting = {
  id: string;
  meetingUrl: string;
  transcript: TranscriptLine[];
  status: MeetingSessionStatus;
  startedAt: number | null;
};

export function useSocket() {
  const [socket] = useState(
    () => io(url, { transports: ["websocket", "polling"] }),
  );
  const [connected, setConnected] = useState(false);
  const [hour0Test, setHour0Test] = useState<Hour0TestPayload | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeeting | null>(
    null,
  );
  const [lastEndedSession, setLastEndedSession] = useState<PastSession | null>(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onHour0 = (payload: Hour0TestPayload) => setHour0Test(payload);

    const onCallStart = (payload: { id: string; callerNumber: string }) =>
      setActiveCall({
        id: payload.id,
        callerNumber: payload.callerNumber,
        transcript: [],
        status: "active",
        startedAt: Date.now(),
      });

    const onCallTranscript = (payload: { role: string; content: string; timestamp?: string }) =>
      setActiveCall((prev) =>
        prev
          ? { ...prev, transcript: [...prev.transcript, { role: payload.role, content: payload.content, timestamp: payload.timestamp ?? new Date().toISOString() }] }
          : prev,
      );

    const onCallEnd = (_payload: { id: string }) =>
      setActiveCall((prev) => {
        if (prev) {
          setLastEndedSession({
            id: prev.id,
            type: "phone",
            caller_number: prev.callerNumber,
            transcript: prev.transcript,
            started_at: new Date(prev.startedAt).toISOString(),
            ended_at: new Date().toISOString(),
          });
        }
        return null;
      });

    const onMeetingJoining = (payload: { id: string; meetingUrl: string }) =>
      setActiveMeeting({
        id: payload.id,
        meetingUrl: payload.meetingUrl,
        transcript: [],
        status: "joining",
        startedAt: null,
      });

    const onMeetingActive = (_payload: { id: string }) =>
      setActiveMeeting((prev) =>
        prev ? { ...prev, status: "active", startedAt: Date.now() } : prev,
      );

    const onMeetingTranscript = (payload: {
      role: string;
      content: string;
      speaker?: string;
      timestamp?: string;
    }) =>
      setActiveMeeting((prev) =>
        prev
          ? {
              ...prev,
              transcript: [
                ...prev.transcript,
                { role: payload.role, content: payload.content, speaker: payload.speaker, timestamp: payload.timestamp ?? new Date().toISOString() },
              ],
            }
          : prev,
      );

    const onMeetingEnded = (_payload: { id: string }) =>
      setActiveMeeting((prev) => {
        if (prev) {
          setLastEndedSession({
            id: prev.id,
            type: "meeting",
            meeting_url: prev.meetingUrl,
            transcript: prev.transcript,
            started_at: prev.startedAt
              ? new Date(prev.startedAt).toISOString()
              : new Date().toISOString(),
            ended_at: new Date().toISOString(),
          });
        }
        return null;
      });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("hour0:test", onHour0);
    socket.on("call:start", onCallStart);
    socket.on("call:transcript", onCallTranscript);
    socket.on("call:end", onCallEnd);
    socket.on("meeting:joining", onMeetingJoining);
    socket.on("meeting:active", onMeetingActive);
    socket.on("meeting:transcript", onMeetingTranscript);
    socket.on("meeting:ended", onMeetingEnded);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("hour0:test", onHour0);
      socket.off("call:start", onCallStart);
      socket.off("call:transcript", onCallTranscript);
      socket.off("call:end", onCallEnd);
      socket.off("meeting:joining", onMeetingJoining);
      socket.off("meeting:active", onMeetingActive);
      socket.off("meeting:transcript", onMeetingTranscript);
      socket.off("meeting:ended", onMeetingEnded);
      socket.disconnect();
    };
  }, [socket]);

  const endCall = useCallback(() => {
    socket.emit("call:end", {});
  }, [socket]);

  const joinMeeting = useCallback(
    (url: string) => {
      socket.emit("meeting:join_now", { url });
    },
    [socket],
  );

  const leaveMeeting = useCallback(() => {
    socket.emit("meeting:leave", {});
  }, [socket]);

  const clearLastEndedSession = useCallback(() => {
    setLastEndedSession(null);
  }, []);

  return {
    socket,
    connected,
    hour0Test,
    activeCall,
    activeMeeting,
    lastEndedSession,
    endCall,
    joinMeeting,
    leaveMeeting,
    clearLastEndedSession,
  };
}
