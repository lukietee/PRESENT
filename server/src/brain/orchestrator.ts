import type { Server as SocketIOServer } from "socket.io";
import { generateResponse, type Message } from "./gemini.js";
import { PHONE_SYSTEM_PROMPT } from "./system-prompt.js";
import { synthesize } from "../phone/elevenlabs-tts.js";
import { sendAudioToTwilio } from "../phone/audio-sender.js";
import { browserAgent } from "../browser-agent/agent.js";


const sessions = new Map<string, Message[]>();
const activeCalls = new Set<string>();

const SENTENCE_END = /(?<=[.?!])\s+/;

function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
  const parts = buffer.split(SENTENCE_END);
  if (parts.length <= 1) {
    return { sentences: [], remainder: buffer };
  }
  const remainder = parts.pop()!;
  return { sentences: parts, remainder };
}

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

  let roundText = "";
  let sentenceBuffer = "";
  let allText = "";
  let fillerPlayed = false;

  try {
    for await (const chunk of generateResponse(history, PHONE_SYSTEM_PROMPT, browserAgent.execute.bind(browserAgent))) {
      if (chunk.startsWith("__TOOL_CALL__")) {
        // Parse tool info and emit to dashboard
        const parts = chunk.split(":");
        if (parts.length >= 3) {
          const toolName = parts[1];
          const toolArgs = parts.slice(2).join(":");
          try {
            io.emit("call:transcript", {
              role: "tool",
              content: `🔧 ${toolName}(${toolArgs})`,
            });
          } catch {}
        }
        // Flush any remaining text from this round before tool executes
        if (sentenceBuffer.trim()) {
          await speakAndEmit(sentenceBuffer.trim(), callSid, io);
          sentenceBuffer = "";
        }

        // Play a short filler only on the first tool round so caller doesn't hear dead silence
        if (!fillerPlayed) {
          fillerPlayed = true;
          try {
            const audio = await synthesize("Yeah, give me one sec.");
            sendAudioToTwilio(callSid, audio);
          } catch {}
        }

        roundText = "";
        continue;
      }

      roundText += chunk;
      allText += chunk;
      sentenceBuffer += chunk;

      const { sentences, remainder } = extractSentences(sentenceBuffer);
      sentenceBuffer = remainder;

      for (const sentence of sentences) {
        await speakAndEmit(sentence, callSid, io);
      }
    }
  } catch (err) {
    console.error("[orchestrator] Error:", err);
    await speakAndEmit("Hey, can I call you back in like 5 minutes?", callSid, io);
  }

  // Flush remaining text
  if (sentenceBuffer.trim()) {
    await speakAndEmit(sentenceBuffer.trim(), callSid, io);
  }

  // Add full response to history for context
  if (allText.trim()) {
    history.push({ role: "model", parts: [{ text: allText }] });
  }

  activeCalls.delete(callSid);
}

export function endSession(callSid: string) {
  sessions.delete(callSid);
  activeCalls.delete(callSid);
  console.log(`[orchestrator] Session ended: ${callSid}`);
}
