import type { Server as SocketIOServer } from "socket.io";
import { generateResponse, type Message } from "./gemini.js";
import { PHONE_SYSTEM_PROMPT } from "./system-prompt.js";
import { synthesize } from "../phone/elevenlabs-tts.js";
import { sendAudioToTwilio } from "../phone/audio-sender.js";

const sessions = new Map<string, Message[]>();

const SENTENCE_END = /(?<=[.?!])\s+/;

function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
  const parts = buffer.split(SENTENCE_END);
  if (parts.length <= 1) {
    return { sentences: [], remainder: buffer };
  }
  const remainder = parts.pop()!;
  return { sentences: parts, remainder };
}

export async function handleTranscript(
  callSid: string,
  transcript: string,
  io: SocketIOServer
) {
  if (!sessions.has(callSid)) {
    sessions.set(callSid, []);
  }
  const history = sessions.get(callSid)!;

  history.push({ role: "user", parts: [{ text: transcript }] });

  let fullResponse = "";
  let sentenceBuffer = "";

  try {
    for await (const chunk of generateResponse(history, PHONE_SYSTEM_PROMPT)) {
      fullResponse += chunk;
      sentenceBuffer += chunk;

      const { sentences, remainder } = extractSentences(sentenceBuffer);
      sentenceBuffer = remainder;

      // TTS each complete sentence sequentially (preserves order)
      for (const sentence of sentences) {
        try {
          const audio = await synthesize(sentence);
          sendAudioToTwilio(callSid, audio);
        } catch (err) {
          console.error("[orchestrator] TTS error:", err);
        }
      }
    }
  } catch (err) {
    console.error("[orchestrator] Error:", err);
    fullResponse = "Hey, can I call you back in like 5 minutes?";
  }

  // Flush remaining text in buffer
  if (sentenceBuffer.trim()) {
    try {
      const audio = await synthesize(sentenceBuffer.trim());
      sendAudioToTwilio(callSid, audio);
    } catch (err) {
      console.error("[orchestrator] TTS flush error:", err);
    }
  }

  if (!fullResponse.trim()) {
    fullResponse = "Hmm, let me think about that...";
  }

  console.log(`[orchestrator] agent: ${fullResponse}`);
  io.emit("call:transcript", { role: "agent", content: fullResponse });

  history.push({ role: "model", parts: [{ text: fullResponse }] });
}

export function endSession(callSid: string) {
  sessions.delete(callSid);
  console.log(`[orchestrator] Session ended: ${callSid}`);
}
