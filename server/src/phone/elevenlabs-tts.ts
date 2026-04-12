import { config } from "../config.js";

/**
 * Synthesize text to mu-law 8kHz audio via ElevenLabs REST streaming endpoint.
 * Returns the full audio as a Buffer (already in mu-law format — no conversion needed).
 */
export async function synthesize(text: string): Promise<Buffer> {
  const { apiKey, voiceId } = config.elevenlabs;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[elevenlabs] TTS failed (${res.status}): ${errText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  console.log(`[elevenlabs] Synthesized ${text.length} chars → ${arrayBuf.byteLength} bytes audio`);
  return Buffer.from(arrayBuf);
}
