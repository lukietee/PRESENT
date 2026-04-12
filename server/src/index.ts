import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { config } from "./config.js";
import { twilioRouter, attachMediaStream } from "./phone/twilio.js";
import { browserAgent } from "./browser-agent/agent.js";
import { registerMeetingSocketHandlers } from "./meeting/socket-handlers.js";
import { installMeetingRuntime, shutdownMeetingRuntime } from "./meeting/meeting-runtime.js";

const dashboardOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const app = express();
app.use(cors({ origin: dashboardOrigins }));
app.use(express.urlencoded({ extended: false })); // Twilio sends form-encoded POST

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: dashboardOrigins,
    methods: ["GET", "POST"],
  },
});

// Hour 0 test — keep until dashboard is wired to real events
io.on("connection", (socket) => {
  console.log("[socket] dashboard connected", socket.id);
  socket.emit("hour0:test", {
    message: "Hello from Present server",
    at: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Past sessions API
import { supabase } from "./supabase.js";
app.get("/api/sessions", async (_req, res) => {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("ended_at", { ascending: false })
    .limit(50);
  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.json(data);
  }
});

// Twilio routes
app.use(twilioRouter);

// Twilio media stream WebSocket
attachMediaStream(httpServer, io);

registerMeetingSocketHandlers(io);
installMeetingRuntime();

httpServer.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
  if (!config.serverUrl) {
    console.warn(
      "[config] SERVER_URL is empty — Twilio <Stream> URL in TwiML will be wrong. Use `npm run tunnel:server`, set SERVER_URL to the ngrok host, restart the server, then point Voice webhook at https://<host>/api/twilio/voice (see .env.example).",
    );
  }
});

// Launch headed browser for tool execution
browserAgent.init().catch((err) => {
  console.error("[browser-agent] Failed to launch:", err);
});

process.on("SIGINT", async () => {
  await shutdownMeetingRuntime();
  await browserAgent.shutdown();
  process.exit(0);
});
