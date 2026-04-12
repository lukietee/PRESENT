import type { Server as SocketIOServer } from "socket.io";
import { randomUUID } from "node:crypto";
import type { ActiveMeetingState } from "./types.js";
import { getMeetingCoordinator } from "./coordinator.js";

const MEET_HOSTS = new Set(["meet.google.com", "www.meet.google.com"]);

function isAllowedMeetUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return false;
    return MEET_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

let activeMeeting: ActiveMeetingState | null = null;

export function getActiveMeeting(): ActiveMeetingState | null {
  return activeMeeting;
}

export function clearActiveMeeting(): void {
  activeMeeting = null;
}

/**
 * Register meeting Socket.IO handlers (call once at startup).
 */
export function registerMeetingSocketHandlers(io: SocketIOServer): void {
  io.on("connection", (socket) => {
    socket.on("meeting:join_now", async ({ url }: { url: string }) => {
      if (!url || typeof url !== "string" || !isAllowedMeetUrl(url)) {
        console.warn("[meeting] rejected join — invalid or non-Meet URL");
        return;
      }
      if (activeMeeting && activeMeeting.status !== "ended") {
        console.warn("[meeting] rejected join — meeting already active");
        return;
      }

      const id = randomUUID();
      activeMeeting = {
        id,
        meetingUrl: url.trim(),
        transcript: [],
        status: "joining",
      };

      io.emit("meeting:joining", { id, meetingUrl: activeMeeting.meetingUrl });
      console.log("[meeting] joining", id);

      try {
        await getMeetingCoordinator().startJoin(activeMeeting.meetingUrl, {
          io,
          meetingId: id,
        });
        if (!activeMeeting || activeMeeting.id !== id) return;
        activeMeeting.status = "active";
        io.emit("meeting:active", { id });
        console.log("[meeting] active", id);
      } catch (err) {
        console.error("[meeting] startJoin failed:", err);
        if (activeMeeting?.id === id) {
          activeMeeting = null;
        }
        io.emit("meeting:ended", { id });
      }
    });

    socket.on("meeting:leave", async () => {
      const current = activeMeeting;
      if (!current) return;
      const id = current.id;
      try {
        await getMeetingCoordinator().leave();
      } catch (err) {
        console.error("[meeting] leave error:", err);
      }
      activeMeeting = null;
      io.emit("meeting:ended", { id });
      console.log("[meeting] ended", id);
    });
  });
}

/** Append transcript line and broadcast (used by integration / brain). */
export function appendMeetingTranscript(
  io: SocketIOServer,
  line: { role: string; content: string; speaker?: string }
): void {
  if (!activeMeeting) return;
  activeMeeting.transcript.push({
    role: line.role,
    content: line.content,
    speaker: line.speaker,
    timestamp: new Date(),
  });
  io.emit("meeting:transcript", {
    role: line.role,
    content: line.content,
    speaker: line.speaker,
  });
}
