import type { Server as SocketIOServer } from "socket.io";
import { config } from "../config.js";
import {
  MEETING_SYSTEM_PROMPT,
  PHONE_SYSTEM_PROMPT,
  USER_NAME,
} from "./system-prompt.js";
import type { Message } from "./gemini.js";
import { synthesizeMeetingPcm24k } from "../phone/elevenlabs-tts.js";
import { appendMeetingTranscript } from "../meeting/socket-handlers.js";
import { runStreamingGeminiReply } from "./streaming-transcript-handler.js";

export type MeetingAudioSinks = {
  toMeetMic: (pcm48kInt16LE: Buffer) => Promise<void>;
  toHeyGen: (pcm24k: Buffer) => void;
};

const sessions = new Map<string, Message[]>();
/** Increments on each final Deepgram utterance so in-flight replies can abort (barge-in). */
const conversationEpoch = new Map<string, number>();

export function bumpMeetingConversationEpoch(meetingId: string): number {
  const n = (conversationEpoch.get(meetingId) ?? 0) + 1;
  conversationEpoch.set(meetingId, n);
  return n;
}

function getMeetingConversationEpoch(meetingId: string): number {
  return conversationEpoch.get(meetingId) ?? 0;
}

export function clearMeetingBrainState(meetingId: string): void {
  sessions.delete(meetingId);
  conversationEpoch.delete(meetingId);
}

/** Linear resample mono s16le 24kHz → 48kHz (factor 2). */
function resamplePcm24kInt16LETo48k(pcm24: Buffer): Buffer {
  const n = Math.floor(pcm24.length / 2);
  if (n === 0) return Buffer.alloc(0);
  const input = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    input[i] = pcm24.readInt16LE(i * 2);
  }
  const outN = 2 * n;
  const output = new Int16Array(outN);
  for (let i = 0; i < outN; i++) {
    const srcIndex = i * 0.5;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, n - 1);
    const frac = srcIndex - i0;
    output[i] = Math.round(input[i0] * (1 - frac) + input[i1] * frac);
  }
  return Buffer.from(output.buffer);
}

export function shouldRespondToMeetingUtterance(transcript: string): boolean {
  if (config.meeting.phoneParity) {
    return true;
  }
  const name = USER_NAME.trim();
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(transcript);
}

function meetingSystemPrompt(): string {
  return config.meeting.phoneParity ? PHONE_SYSTEM_PROMPT : MEETING_SYSTEM_PROMPT;
}

async function speakMeetingSentence(
  text: string,
  io: SocketIOServer,
  sinks: MeetingAudioSinks
): Promise<void> {
  if (!text.trim()) return;
  console.log(`[meeting-orchestrator] agent: ${text}`);
  appendMeetingTranscript(io, { role: "agent", content: text });
  try {
    const pcm24 = await synthesizeMeetingPcm24k(text);
    sinks.toHeyGen(pcm24);
    const pcm48 = resamplePcm24kInt16LETo48k(pcm24);
    await sinks.toMeetMic(pcm48);
  } catch (err) {
    console.error("[meeting-orchestrator] TTS error:", err);
  }
}

export async function handleMeetingTranscript(
  meetingId: string,
  transcript: string,
  io: SocketIOServer,
  sinks: MeetingAudioSinks,
  replyEpoch: number
): Promise<void> {
  if (!sessions.has(meetingId)) {
    sessions.set(meetingId, []);
  }
  const history = sessions.get(meetingId)!;
  history.push({ role: "user", parts: [{ text: transcript }] });

  if (!shouldRespondToMeetingUtterance(transcript)) {
    return;
  }

  const stale = () => getMeetingConversationEpoch(meetingId) !== replyEpoch;

  await runStreamingGeminiReply(history, {
    systemPrompt: meetingSystemPrompt(),
    shouldAbort: stale,
    logLabel: "meeting-orchestrator",
    errorFallback: "Hey, can I follow up with you on that after the call?",
    speakSentence: async (text) => {
      if (stale()) return;
      await speakMeetingSentence(text, io, sinks);
    },
  });
}
