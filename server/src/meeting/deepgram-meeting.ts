import { DeepgramClient } from "@deepgram/sdk";
import type { Server as SocketIOServer } from "socket.io";
import { config } from "../config.js";

const connections = new Map<string, { socket: any; ready: boolean }>();

export async function createMeetingDeepgramStream(
  sessionId: string,
  io: SocketIOServer,
  onFinal: (sessionId: string, transcript: string, io: SocketIOServer) => void
) {
  const client = new DeepgramClient({ apiKey: config.deepgram.apiKey });

  // WrappedListenV1Client supplies auth from apiKey; generated ConnectArgs still list Authorization.
  const socket = await client.listen.v1.connect({
    encoding: "linear16",
    sample_rate: 16000,
    channels: 1,
    model: "nova-2",
    punctuate: true,
    interim_results: true,
    utterance_end_ms: 1000,
  } as unknown as Parameters<DeepgramClient["listen"]["v1"]["connect"]>[0]);

  const entry = { socket, ready: false };
  connections.set(sessionId, entry);

  socket.on("open", () => {
    console.log(`[deepgram:meeting] Connection opened — sessionId=${sessionId}`);
    entry.ready = true;
  });

  socket.on("message", (data: any) => {
    const transcript = data?.channel?.alternatives?.[0]?.transcript;
    if (!transcript) return;

    if (data.is_final) {
      console.log(`[deepgram:meeting] final: ${transcript}`);
      onFinal(sessionId, transcript, io);
    }
  });

  socket.on("error", (err: any) => {
    console.error("[deepgram:meeting] Error:", err);
  });

  socket.on("close", () => {
    console.log(`[deepgram:meeting] Connection closed — sessionId=${sessionId}`);
    connections.delete(sessionId);
  });

  socket.connect();
}

export function sendMeetingPcm(sessionId: string, buf: Buffer) {
  const entry = connections.get(sessionId);
  if (!entry?.ready) return;
  entry.socket.sendMedia(buf);
}

export function closeMeetingDeepgramStream(sessionId: string) {
  const entry = connections.get(sessionId);
  if (!entry) return;
  entry.socket.close();
  connections.delete(sessionId);
}
