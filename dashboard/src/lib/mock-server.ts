/**
 * Dev-only mock Socket.IO server. Run from dashboard: `npm run mock-server`
 * Stop the real backend first — both use port 3001 by default.
 */
import { Server } from "socket.io";

const io = new Server(3001, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  setTimeout(() => {
    socket.emit("call:start", { id: "1", callerNumber: "+1234567890" });
  }, 2000);

  setTimeout(() => {
    socket.emit("call:transcript", {
      role: "caller",
      content: "Hey where are we on the capstone?",
    });
  }, 4000);

  setTimeout(() => {
    socket.emit("call:transcript", {
      role: "agent",
      content: "Yeah let me check on that real quick...",
    });
  }, 6000);

  socket.on("meeting:join_now", ({ url }: { url: string }) => {
    socket.emit("meeting:joining", { id: "2", meetingUrl: url });
    setTimeout(() => socket.emit("meeting:active", { id: "2" }), 3000);
    setTimeout(() => {
      socket.emit("meeting:transcript", {
        role: "participant",
        content: "Lucas, what did you work on?",
        speaker: "Jake",
      });
    }, 5000);
  });
});

console.log("[mock-server] Socket.IO listening on http://localhost:3001");
