import type { Server as SocketIOServer } from "socket.io";
import type { Message } from "./gemini.js";
import { PHONE_SYSTEM_PROMPT } from "./system-prompt.js";
import { synthesize } from "../phone/elevenlabs-tts.js";
import { sendAudioToTwilio } from "../phone/audio-sender.js";
import { runStreamingGeminiReply } from "./streaming-transcript-handler.js";
import { appendCallTranscript } from "../phone/twilio.js";

const sessions = new Map<string, Message[]>();
const activeCalls = new Set<string>();

function formatToolCall(toolName: string, toolArgs: string): string {
  try {
    const args = JSON.parse(toolArgs);
    switch (toolName) {
      case "list_files":
        if (args.search) return `🔧 Searching files for "${args.search}"`;
        return `🔧 Listing files in ${args.directory || "/"}`;
      case "open_file": {
        const filename = (args.path || "").split("/").pop() || args.path;
        return `🔧 Opening ${filename}`;
      }
      case "check_calendar":
        return `🔧 Checking calendar${args.date ? ` for ${args.date}` : ""}`;
      case "create_event":
        return `🔧 Creating event: "${args.title || "Untitled"}"`;
      case "send_email":
        return `🔧 Sending email to ${args.to || "recipient"}`;
      case "browse_url":
        return `🔧 Browsing ${args.url || "page"}`;
      case "read_page":
        return "🔧 Reading page";
      case "click":
        return `🔧 Clicking "${args.text || args.selector || "element"}"`;
      case "type":
        return `🔧 Typing text`;
    }
  } catch {
    // JSON parse failed — fall through
  }
  return `🔧 ${toolName}(${toolArgs})`;
}

async function speakAndEmit(
  text: string,
  callSid: string,
  io: SocketIOServer
) {
  if (!text.trim()) return;
  console.log(`[orchestrator] agent: ${text}`);
  io.emit("call:transcript", { role: "agent", content: text });
  appendCallTranscript(callSid, { role: "agent", content: text });
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
      onToolCall: (toolName, toolArgs) => {
        const toolContent = formatToolCall(toolName, toolArgs);
        io.emit("call:transcript", { role: "tool", content: toolContent });
        appendCallTranscript(callSid, { role: "tool", content: toolContent });
      },
    });
  } finally {
    activeCalls.delete(callSid);
  }
}

/** Returns the transcript before clearing the session. */
export function endSession(callSid: string): Message[] | null {
  const history = sessions.get(callSid) ?? null;
  sessions.delete(callSid);
  activeCalls.delete(callSid);
  console.log(`[orchestrator] Session ended: ${callSid}`);
  return history;
}
