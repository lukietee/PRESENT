import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** Host only (e.g. abc.ngrok-free.app) for wss:// in TwiML — strips https:// and paths. */
function serverHostFromEnv(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  s = s.replace(/^wss?:\/\//i, "").replace(/^https?:\/\//i, "");
  const host = s.split("/")[0]?.trim() ?? "";
  return host;
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  serverUrl: serverHostFromEnv(process.env.SERVER_URL || ""),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  },
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || "",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || "",
    voiceId: process.env.ELEVENLABS_VOICE_ID || "",
  },
} as const;
