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
  heygen: {
    apiKey: process.env.HEYGEN_API_KEY || "",
    avatarId: process.env.HEYGEN_AVATAR_ID || "",
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
  },
  /** Google Meet blocks obvious automation — see meeting-joiner + .env.example */
  meeting: {
    /** Use installed Google Chrome instead of bundled Chromium (recommended for Meet). */
    useChromeChannel:
      process.env.MEET_USE_CHROME_CHANNEL === "1" ||
      process.env.MEET_USE_CHROME_CHANNEL === "true",
    phoneParity:
      process.env.MEETING_PHONE_PARITY !== "0" &&
      process.env.MEETING_PHONE_PARITY !== "false",
    /** Optional full User-Agent string (recent desktop Chrome). */
    userAgent: (process.env.MEET_USER_AGENT || "").trim(),
    /**
     * Playwright's fake media flags can trigger Meet's "can't join" for some accounts.
     * Set MEET_USE_FAKE_MEDIA=0 to use real device prompts (headed only).
     */
    useFakeMediaStream:
      process.env.MEET_USE_FAKE_MEDIA !== "0" &&
      process.env.MEET_USE_FAKE_MEDIA !== "false",
  },
} as const;
