import { DeepgramClient } from "@deepgram/sdk";
import type { Server as SocketIOServer } from "socket.io";
import { config } from "../config.js";
import { handleTranscript } from "../brain/orchestrator.js";
import { clearTwilioAudio } from "./audio-sender.js";

const connections = new Map<string, { socket: any; ready: boolean }>();
const utteranceBuffers = new Map<string, string>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

const DEBOUNCE_SHORT = 150; // Quick response for short complete utterances
const DEBOUNCE_LONG = 700;  // Wait longer for potentially incomplete sentences

function getDebounceMs(buffer: string): number {
  const trimmed = buffer.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const endsWithPunctuation = /[.?!]$/.test(trimmed);
  // Short + ends with punctuation = complete thought, respond fast
  if (wordCount <= 6 && endsWithPunctuation) return DEBOUNCE_SHORT;
  return DEBOUNCE_LONG;
}

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
  utteranceBuffers.set(callSid, "");

  socket.on("open", () => {
    console.log(`[deepgram] Connection opened — callSid=${callSid}`);
    entry.ready = true;
  });

  socket.on("message", (data: any) => {
    const transcript = data?.channel?.alternatives?.[0]?.transcript;
    if (!transcript) return;

    if (data.is_final) {
      // Accumulate finalized segments
      const current = utteranceBuffers.get(callSid) || "";
      utteranceBuffers.set(callSid, current + (current ? " " : "") + transcript);
      console.log(`[deepgram] segment: ${transcript}`);

      // Clear and reset the debounce timer
      const existing = debounceTimers.get(callSid);
      if (existing) clearTimeout(existing);

      // Wait for silence — adaptive timing based on utterance length
      const debounceMs = getDebounceMs(utteranceBuffers.get(callSid) || "");
      const timer = setTimeout(() => {
        const fullUtterance = utteranceBuffers.get(callSid)?.trim();
        utteranceBuffers.set(callSid, "");
        debounceTimers.delete(callSid);

        if (fullUtterance) {
          console.log(`[deepgram] utterance: ${fullUtterance}`);
          clearTwilioAudio(callSid);
          io.emit("call:transcript", { role: "caller", content: fullUtterance });
          handleTranscript(callSid, fullUtterance, io);
        }
      }, debounceMs);

      debounceTimers.set(callSid, timer);
    }
  });

  socket.on("error", (err: any) => {
    console.error("[deepgram] Error:", err);
  });

  socket.on("close", () => {
    console.log(`[deepgram] Connection closed — callSid=${callSid}`);
    connections.delete(callSid);
    utteranceBuffers.delete(callSid);
    const timer = debounceTimers.get(callSid);
    if (timer) clearTimeout(timer);
    debounceTimers.delete(callSid);
  });

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
  utteranceBuffers.delete(callSid);
  const timer = debounceTimers.get(callSid);
  if (timer) clearTimeout(timer);
  debounceTimers.delete(callSid);
}
