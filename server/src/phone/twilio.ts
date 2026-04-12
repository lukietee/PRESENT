import { Router } from "express";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import type { Server as SocketIOServer } from "socket.io";
import twilio from "twilio";
import { config } from "../config.js";
import { createDeepgramStream, sendAudio, closeDeepgramStream } from "./deepgram-stt.js";
import { endSession } from "../brain/orchestrator.js";
import { synthesize } from "./elevenlabs-tts.js";
import { sendAudioToTwilio } from "./audio-sender.js";
import { saveSession } from "../supabase.js";

// Track call metadata + transcript lines for persistence
const callMeta = new Map<string, { startedAt: string; transcript: { role: string; content: string; timestamp: string }[] }>();

export function appendCallTranscript(callSid: string, line: { role: string; content: string }) {
  const meta = callMeta.get(callSid);
  if (meta) {
    meta.transcript.push({ ...line, timestamp: new Date().toISOString() });
  }
}

// ── TwiML webhook route ─────────────────────────────────────────────

export const twilioRouter = Router();

twilioRouter.post("/api/twilio/voice", (req, res) => {
  if (!config.serverUrl) {
    console.error("[twilio] Incoming call but SERVER_URL is not set (ngrok host)");
    res
      .status(500)
      .type("text/plain")
      .send("SERVER_URL missing — set ngrok host in .env and restart the server.");
    return;
  }

  const callerNumber = req.body?.From ?? "unknown";
  console.log(`[twilio] Incoming call from ${callerNumber}`);

  const twiml = new twilio.twiml.VoiceResponse();
  const connect = twiml.connect();
  connect.stream({ url: `wss://${config.serverUrl}/media-stream` });

  res.type("text/xml").send(twiml.toString());
});

// ── Twilio stream registry (so other modules can send audio back) ───

export const twilioStreams = new Map<string, { ws: WebSocket; streamSid: string }>();

// ── Media stream WebSocket ──────────────────────────────────────────

interface TwilioMediaMessage {
  event: "connected" | "start" | "media" | "stop";
  streamSid?: string;
  start?: {
    streamSid: string;
    callSid: string;
    customParameters?: Record<string, string>;
  };
  media?: {
    payload: string;
    track: string;
  };
}

export function attachMediaStream(httpServer: HttpServer, io: SocketIOServer) {
  const wss = new WebSocketServer({ noServer: true });

  // Manual upgrade — only handle /media-stream, let Socket.IO handle its own path
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url === "/media-stream") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    let streamSid = "";
    let callSid = "";

    console.log("[twilio] Media stream WebSocket connected");

    ws.on("message", (raw: Buffer) => {
      const msg: TwilioMediaMessage = JSON.parse(raw.toString());

      switch (msg.event) {
        case "connected":
          console.log("[twilio] Stream connected");
          break;

        case "start":
          streamSid = msg.start!.streamSid;
          callSid = msg.start!.callSid;
          console.log(
            `[twilio] Stream started — callSid=${callSid} streamSid=${streamSid}`
          );
          twilioStreams.set(callSid, { ws, streamSid });
          callMeta.set(callSid, { startedAt: new Date().toISOString(), transcript: [] });
          io.emit("call:start", { id: callSid, callerNumber: "unknown" });
          createDeepgramStream(callSid, io);

          // Greet the caller — short delay so the audio channel is ready
          setTimeout(() => {
            synthesize("Hello?").then((audio) => {
              sendAudioToTwilio(callSid, audio);
              io.emit("call:transcript", { role: "agent", content: "Hello?" });
              appendCallTranscript(callSid, { role: "agent", content: "Hello?" });
            }).catch(() => {});
          }, 800);
          break;

        case "media": {
          // Only process inbound audio (caller), ignore outbound (our TTS)
          if (msg.media!.track !== "inbound") break;
          const audioBuffer = Buffer.from(msg.media!.payload, "base64");
          sendAudio(callSid, audioBuffer);
          break;
        }

        case "stop": {
          console.log(`[twilio] Stream stopped — callSid=${callSid}`);
          twilioStreams.delete(callSid);
          closeDeepgramStream(callSid);
          const meta = callMeta.get(callSid);
          endSession(callSid);
          io.emit("call:end", { id: callSid });
          if (meta) {
            callMeta.delete(callSid);
            saveSession({
              type: "phone",
              caller_number: "unknown",
              transcript: meta.transcript,
              started_at: meta.startedAt,
              ended_at: new Date().toISOString(),
            });
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      console.log(`[twilio] WebSocket closed — callSid=${callSid}`);
      if (callSid) {
        twilioStreams.delete(callSid);
        closeDeepgramStream(callSid);
        const meta = callMeta.get(callSid);
        endSession(callSid);
        io.emit("call:end", { id: callSid });
        if (meta) {
          callMeta.delete(callSid);
          saveSession({
            type: "phone",
            caller_number: "unknown",
            transcript: meta.transcript,
            started_at: meta.startedAt,
            ended_at: new Date().toISOString(),
          });
        }
      }
    });

    ws.on("error", (err) => {
      console.error("[twilio] WebSocket error:", err);
    });
  });
}
