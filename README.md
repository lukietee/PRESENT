# Present!

**An AI agent that answers your phone calls as you.**

Present! picks up incoming phone calls, speaks in your cloned voice, and handles real tasks — searching files, reading documents, checking your calendar, creating events, and sending emails with attachments. You monitor everything in real-time from a live dashboard.

## Demo

Call the Twilio number. The AI agent answers as you, has a natural conversation, and executes tasks on your computer — all while you watch the live transcript and approve tool calls from the dashboard.

**Live Dashboard:** [dashboard-ten-rho-71.vercel.app](https://dashboard-ten-rho-71.vercel.app)

## How It Works

```
Caller dials your number
        │
        ▼
   Twilio receives call → streams audio via WebSocket
        │
        ▼
   Deepgram STT → real-time speech-to-text (nova-2)
        │
        ▼
   Gemini 2.5 Flash → decides what to say + which tools to use
        │
        ▼
   ElevenLabs TTS → synthesizes response in YOUR cloned voice
        │
        ▼
   Audio streamed back to caller via Twilio
        │
        ▼
   Dashboard shows live transcript, tool calls need your approval
```

## Features

### Voice Agent
- **Answers phone calls** as you — first-person, casual, natural
- **Cloned voice** via ElevenLabs — sounds like you, not a robot
- **Real-time speech** — streams TTS audio back to the caller with low latency
- **Barge-in support** — caller can interrupt the agent mid-sentence
- **Adaptive debounce** — waits for natural pauses before responding

### Tool Execution
The agent can perform real actions on your computer during a call:

| Tool | What it does |
|------|-------------|
| `list_files` | Searches Desktop/Documents/Downloads for files |
| `open_file` | Opens and reads .docx, .txt, .csv, .json, .md files |
| `check_calendar` | Queries Apple Calendar for events |
| `create_event` | Creates calendar events via .ics files |
| `send_email` | Sends emails with attachments via Outlook/Mail.app |
| `browse_url` | Opens URLs in a headed browser |

### Dashboard
- **Live transcript** — see the conversation as it happens, with timestamps
- **Tool approval gate** — Claude Code-style Allow/Deny before any tool executes
- **Call duration timer** — live elapsed time counter
- **Fullscreen chat mode** — expand to full viewport for mobile use
- **Past sessions** — browse previous calls with expandable transcripts (persisted in Supabase)
- **Voice cloning** — record or upload audio to clone your voice from the dashboard
- **Copy transcript** — one-click copy of the full conversation
- **Confirmation dialogs** — safety net before ending calls
- **Toast notifications** — feedback for actions
- **Mobile-friendly** — deployed on Vercel, accessible from your phone

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Phone** | Twilio (Voice API + Media Streams WebSocket) |
| **Speech-to-Text** | Deepgram (nova-2, real-time streaming) |
| **LLM** | Google Gemini 2.5 Flash (multi-round tool calling) |
| **Text-to-Speech** | ElevenLabs (turbo v2.5, instant voice cloning) |
| **Tool Execution** | Playwright (headed Chromium for browser automation) |
| **Server** | Node.js, Express, Socket.IO |
| **Dashboard** | Next.js 16, React 19, Tailwind CSS 4 |
| **Database** | Supabase (PostgreSQL — session history) |
| **Hosting** | Vercel (dashboard), ngrok (server tunnel) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)               │
│  Live transcript │ Tool approval │ Voice cloning     │
│  Past sessions   │ Fullscreen    │ Connection status │
└────────────┬────────────────────────────────────────┘
             │ Socket.IO (real-time)
             ▼
┌─────────────────────────────────────────────────────┐
│                    Server (Express)                   │
│                                                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Twilio   │  │ Orchestrator │  │ Browser Agent  │ │
│  │ Media WS │→ │ (Gemini)     │→ │ (Playwright)   │ │
│  └──────────┘  └──────────────┘  └────────────────┘ │
│       │              │                    │           │
│       ▼              ▼                    ▼           │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Deepgram │  │ ElevenLabs   │  │ Files, Calendar│ │
│  │ STT      │  │ TTS          │  │ Email, Browser │ │
│  └──────────┘  └──────────────┘  └────────────────┘ │
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ Supabase — session history + transcripts         ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Setup

### Prerequisites
- Node.js 24+
- Twilio account with a phone number
- Deepgram API key
- Google Gemini API key
- ElevenLabs API key
- Supabase project
- ngrok (for exposing the server to Twilio)

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
DEEPGRAM_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
SERVER_URL=           # ngrok host (e.g. abc.ngrok-free.app)
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

### Running

```bash
# Terminal 1 — expose server to Twilio
ngrok http 3001

# Terminal 2 — start server
cd server && npm install && npm run dev

# Terminal 3 — start dashboard
cd dashboard && npm install && npm run dev
```

Set your Twilio Voice webhook to `https://<ngrok-host>/api/twilio/voice`.

Open `http://localhost:3000` to see the dashboard.

## Team

Built by **Lucas Tran** ([@lukietee](https://github.com/lukietee))
