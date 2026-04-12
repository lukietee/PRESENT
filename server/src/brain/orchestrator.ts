import type { Server as SocketIOServer } from "socket.io";
import type { Message } from "./gemini.js";
import { PHONE_SYSTEM_PROMPT } from "./system-prompt.js";
import { synthesize } from "../phone/elevenlabs-tts.js";
import { sendAudioToTwilio } from "../phone/audio-sender.js";
import { runStreamingGeminiReply } from "./streaming-transcript-handler.js";

const sessions = new Map<string, Message[]>();
const activeCalls = new Set<string>();

async function speakAndEmit(
  text: string,
  callSid: string,
  io: SocketIOServer
) {
  if (!text.trim()) return;
  console.log(`[orchestrator] agent: ${text}`);
  io.emit("call:transcript", { role: "agent", content: text });
  try {
    const audio = await synthesize(text);
    sendAudioToTwilio(callSid, audio);
  } catch (err) {
    console.error("[orchestrator] TTS error:", err);
  }
}

export async function handleTranscript(
  callSid: string,
  transcript: string,
  io: SocketIOServer
) {
  if (activeCalls.has(callSid)) {
    console.log(`[orchestrator] Skipping — already responding to callSid=${callSid}`);
    return;
  }
  activeCalls.add(callSid);

  if (!sessions.has(callSid)) {
    sessions.set(callSid, []);
  }
  const history = sessions.get(callSid)!;

  history.push({ role: "user", parts: [{ text: transcript }] });

  try {
    await runStreamingGeminiReply(history, {
      systemPrompt: PHONE_SYSTEM_PROMPT,
      shouldAbort: () => false,
      logLabel: "orchestrator",
      errorFallback: "Hey, can I call you back in like 5 minutes?",
      speakSentence: (text) => speakAndEmit(text, callSid, io),
    });
  } finally {
    activeCalls.delete(callSid);
  }
}

export function endSession(callSid: string) {
  sessions.delete(callSid);
  activeCalls.delete(callSid);
  console.log(`[orchestrator] Session ended: ${callSid}`);
}
