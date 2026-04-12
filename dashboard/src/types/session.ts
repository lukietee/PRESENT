/**
 * Session-related types aligned with in-memory state in architecture/07-api-contract.md
 * (activeCall / activeMeeting). Server uses Date for transcript timestamps; UI may use ISO strings.
 */

export type TranscriptLine = {
  role: string;
  content: string;
  speaker?: string;
  /** Optional for UI; server state uses Date when persisted in memory */
  timestamp?: string;
  /** Unique ID for tool approval flow */
  toolId?: string;
  /** Status of a tool call approval */
  toolStatus?: "pending" | "approved" | "denied";
};

export type PhoneSessionStatus = "active" | "ended";

export type MeetingSessionStatus = "joining" | "active" | "ended";
