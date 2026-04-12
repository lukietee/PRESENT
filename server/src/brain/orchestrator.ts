import type { Server as SocketIOServer } from "socket.io";
import { generateResponse, type Message } from "./gemini.js";
import { PHONE_SYSTEM_PROMPT } from "./system-prompt.js";

const sessions = new Map<string, Message[]>();

export async function handleTranscript(
  callSid: string,
  transcript: string,
  io: SocketIOServer
) {
  // Get or create conversation history
  if (!sessions.has(callSid)) {
    sessions.set(callSid, []);
  }
  const history = sessions.get(callSid)!;

  // Add caller's message
  history.push({ role: "user", parts: [{ text: transcript }] });

  // Stream Gemini response
  let fullResponse = "";
  try {
    for await (const chunk of generateResponse(history, PHONE_SYSTEM_PROMPT)) {
      fullResponse += chunk;
    }
  } catch (err) {
    console.error("[orchestrator] Error:", err);
    fullResponse = "Hey, can I call you back in like 5 minutes?";
  }

  // Fallback if Gemini returned nothing (e.g. only tool calls)
  if (!fullResponse.trim()) {
    fullResponse = "Hmm, let me think about that...";
  }

  console.log(`[orchestrator] agent: ${fullResponse}`);
  io.emit("call:transcript", { role: "agent", content: fullResponse });

  // Add AI response to history
  history.push({ role: "model", parts: [{ text: fullResponse }] });
}

export function endSession(callSid: string) {
  sessions.delete(callSid);
  console.log(`[orchestrator] Session ended: ${callSid}`);
}
