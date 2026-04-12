import type {
  MeetingSessionStatus,
  PhoneSessionStatus,
  TranscriptLine,
} from "@/types/session";

/** Mirrors server in-memory `activeCall` in architecture/07-api-contract.md */
export type MockActiveCall = {
  id: string;
  callerNumber: string;
  transcript: TranscriptLine[];
  status: PhoneSessionStatus;
};

/** Mirrors server in-memory `activeMeeting` in architecture/07-api-contract.md */
export type MockActiveMeeting = {
  id: string;
  meetingUrl: string;
  transcript: TranscriptLine[];
  status: MeetingSessionStatus;
};

export const initialMockActiveCall: MockActiveCall = {
  id: "1",
  callerNumber: "+1 (555) 010-4242",
  status: "active",
  transcript: [
    {
      role: "caller",
      content: "Hey can you check where we're at on the capstone?",
    },
    {
      role: "agent",
      content: "Yeah for sure, let me pull that up...",
    },
  ],
};

export const initialMockActiveMeeting: MockActiveMeeting = {
  id: "2",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  status: "joining",
  transcript: [
    {
      role: "participant",
      content: "Lucas, what did you work on yesterday?",
      speaker: "Jake",
    },
    {
      role: "agent",
      content: "I pushed the auth middleware and fixed that CORS bug",
    },
  ],
};

/** Maps mock call state into SessionCard props (phone variant). */
export function mockCallToSessionCardFields(call: MockActiveCall) {
  return {
    subtitle: call.callerNumber,
    messages: call.transcript,
    status: call.status,
  };
}

/** Maps mock meeting state into SessionCard props (meeting variant). */
export function mockMeetingToSessionCardFields(meeting: MockActiveMeeting) {
  return {
    subtitle: meeting.meetingUrl,
    messages: meeting.transcript,
    status: meeting.status,
  };
}
