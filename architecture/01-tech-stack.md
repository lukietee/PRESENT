# Tech Stack

**Hackathon sponsor tracks:** Gemini (Google) + ElevenLabs

| Component | Technology | Why |
|-----------|-----------|-----|
| **Telephony** | Twilio Programmable Voice + Media Streams | WebSocket audio streaming, real phone numbers |
| **Speech-to-Text** | Deepgram (streaming) | ~300ms latency, WebSocket API, handles mu-law natively |
| **LLM Brain** | Gemini 2.5 Pro (Google) | Streaming, function calling, sponsor track |
| **Text-to-Speech** | ElevenLabs (WebSocket streaming, Turbo v2.5) | Voice cloning, low-latency streaming, sponsor track |
| **Avatar Video** | HeyGen LiveAvatar (LITE mode) | Real-time lip-synced avatar, WebRTC via LiveKit |
| **Meeting Join** | Playwright (headed) | Join Google Meet via browser, inject camera+mic |
| **Browser Agent** | Playwright (headless) | Separate browser context for tool actions (Drive, GitHub, etc.) |
| **Backend** | Node.js + Express + Socket.IO | WebSocket handling, streaming ecosystem |
| **Frontend** | Next.js (App Router) + Tailwind + shadcn/ui | Single-page dashboard |

**Cut for MVP (add back later):**
- ~~Database (Neon Postgres)~~ → in-memory state
- ~~Auth~~ → single user, no auth needed
- ~~Zoom/Teams support~~ → Google Meet only
- ~~Deepgram diarization~~ → basic STT only
- ~~Action approval UI~~ → all tool calls auto-approved
