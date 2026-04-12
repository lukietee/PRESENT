import { twilioStreams } from "./twilio.js";

const FRAME_SIZE = 160; // 20ms at 8kHz mu-law (1 byte per sample)

/**
 * Clear any queued/playing audio on the Twilio stream (barge-in).
 */
export function clearTwilioAudio(callSid: string): void {
  const stream = twilioStreams.get(callSid);
  if (!stream) return;
  try {
    stream.ws.send(JSON.stringify({ event: "clear", streamSid: stream.streamSid }));
  } catch {}
}

/**
 * Send a mu-law audio buffer to the caller via Twilio's media WebSocket.
 * Chunks into 20ms frames as Twilio expects.
 */
export function sendAudioToTwilio(callSid: string, audioBuffer: Buffer): void {
  const stream = twilioStreams.get(callSid);
  if (!stream) {
    console.warn(`[audio-sender] No Twilio stream for callSid=${callSid}`);
    return;
  }

  const { ws, streamSid } = stream;

  for (let offset = 0; offset < audioBuffer.length; offset += FRAME_SIZE) {
    const frame = audioBuffer.subarray(offset, offset + FRAME_SIZE);
    const payload = frame.toString("base64");

    try {
      ws.send(JSON.stringify({
        event: "media",
        streamSid,
        media: { payload },
      }));
    } catch (err) {
      console.error("[audio-sender] ws.send error:", err);
      return;
    }
  }
}
