import type { Server as SocketIOServer } from "socket.io";

/**
 * Server meeting state — aligned with architecture/07-api-contract.md
 */

export type MeetingSessionStatus = "joining" | "active" | "ended";

export type MeetingTranscriptLine = {
  role: string;
  content: string;
  speaker?: string;
  timestamp: Date;
};

export type ActiveMeetingState = {
  id: string;
  meetingUrl: string;
  transcript: MeetingTranscriptLine[];
  status: MeetingSessionStatus;
};

export type MeetingRunContext = {
  io: SocketIOServer;
  meetingId: string;
};
