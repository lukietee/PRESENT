import { DeepgramClient } from "@deepgram/sdk";
import type { Server as SocketIOServer } from "socket.io";
import { config } from "../config.js";
import { handleTranscript } from "../brain/orchestrator.js";
import { clearTwilioAudio } from "./audio-sender.js";

// One Deepgram connection per active call
const connections = new Map<string, { socket: any; ready: boolean }>();

export async function createDeepgramStream(callSid: string, io: SocketIOServer) {
  const client = new DeepgramClient({ apiKey: config.deepgram.apiKey });

  const socket = await client.listen.v1.connect({
    encoding: "mulaw",
    sample_rate: 8000,
    channels: 1,
    model: "nova-2",
    punctuate: true,
    interim_results: true,
    utterance_end_ms: 1000,
  } as unknown as Parameters<DeepgramClient["listen"]["v1"]["connect"]>[0]);

  const entry = { socket, ready: false };
  connections.set(callSid, entry);

  socket.on("open", () => {
    console.log(`[deepgram] Connection opened — callSid=${callSid}`);
    entry.ready = true;
  });

  socket.on("message", (data: any) => {
    const transcript = data?.channel?.alternatives?.[0]?.transcript;
    if (!transcript) return;

    if (data.is_final) {
      console.log(`[deepgram] final: ${transcript}`);
      clearTwilioAudio(callSid); // Stop any AI audio playing (barge-in)
      io.emit("call:transcript", { role: "caller", content: transcript });
      handleTranscript(callSid, transcript, io);
    }
  });

  socket.on("error", (err: any) => {
    console.error("[deepgram] Error:", err);
  });

  socket.on("close", () => {
    console.log(`[deepgram] Connection closed — callSid=${callSid}`);
    connections.delete(callSid);
  });

  // Must call connect() after registering event handlers
  socket.connect();
}

export function sendAudio(callSid: string, audioBuffer: Buffer) {
  const entry = connections.get(callSid);
  if (!entry?.ready) return;
  entry.socket.sendMedia(audioBuffer);
}

export function closeDeepgramStream(callSid: string) {
  const entry = connections.get(callSid);
  if (!entry) return;
  entry.socket.close();
  connections.delete(callSid);
}
