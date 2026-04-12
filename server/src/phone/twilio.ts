import { Router } from "express";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import type { Server as SocketIOServer } from "socket.io";
import twilio from "twilio";
import { config } from "../config.js";
import { createDeepgramStream, sendAudio, closeDeepgramStream } from "./deepgram-stt.js";
import { endSession } from "../brain/orchestrator.js";

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
          io.emit("call:start", { id: callSid, callerNumber: "unknown" });
          createDeepgramStream(callSid, io);
          break;

        case "media": {
          const audioBuffer = Buffer.from(msg.media!.payload, "base64");
          sendAudio(callSid, audioBuffer);
          break;
        }

        case "stop":
          console.log(`[twilio] Stream stopped — callSid=${callSid}`);
          closeDeepgramStream(callSid);
          endSession(callSid);
          io.emit("call:end", { id: callSid });
          break;
      }
    });

    ws.on("close", () => {
      console.log(`[twilio] WebSocket closed — callSid=${callSid}`);
      if (callSid) {
        closeDeepgramStream(callSid);
        endSession(callSid);
        io.emit("call:end", { id: callSid });
      }
    });

    ws.on("error", (err) => {
      console.error("[twilio] WebSocket error:", err);
    });
  });
}
