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

// Voice cloning API
import multer from "multer";
import { setActiveVoiceId, getActiveVoiceId } from "./phone/elevenlabs-tts.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.post("/api/voice/clone", upload.single("audio"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }

  const apiKey = config.elevenlabs.apiKey;
  if (!apiKey) {
    res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
    return;
  }

  try {
    const form = new FormData();
    form.append("name", "Present! Voice Clone");
    form.append("description", "Voice cloned via Present! dashboard");
    const blob = new Blob([file.buffer], { type: file.mimetype || "audio/mpeg" });
    form.append("files", blob, file.originalname || "recording.mp3");

    console.log(`[voice-clone] Uploading ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

    const elRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error("[voice-clone] ElevenLabs error:", errText);
      res.status(500).json({ error: "Voice cloning failed", details: errText });
      return;
    }

    const data = await elRes.json() as { voice_id: string };
    setActiveVoiceId(data.voice_id);
    console.log(`[voice-clone] Voice cloned successfully: ${data.voice_id}`);
    res.json({ voice_id: data.voice_id });
  } catch (err: any) {
    console.error("[voice-clone] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/voice/current", (_req, res) => {
  res.json({ voice_id: getActiveVoiceId() });
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
