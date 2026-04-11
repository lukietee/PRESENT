# Project Structure

## File Tree (~18 files total)

```
phoneclone/
├── server/
│   ├── src/
│   │   ├── index.ts              # Express + Socket.IO entry point
│   │   ├── config.ts             # Env vars
│   │   │
│   │   ├── brain/
│   │   │   ├── orchestrator.ts   # Shared conversation loop + shouldRespond
│   │   │   ├── gemini.ts         # Gemini streaming + function calling
│   │   │   └── system-prompt.ts  # Hardcoded phone + meeting prompts
│   │   │
│   │   ├── phone/
│   │   │   ├── twilio.ts         # Webhook + media stream handler
│   │   │   ├── deepgram-stt.ts   # Streaming STT
│   │   │   ├── elevenlabs-tts.ts # Streaming TTS
│   │   │   └── audio-utils.ts    # mu-law conversion
│   │   │
│   │   ├── meeting/
│   │   │   ├── meeting-joiner.ts # Playwright: join Google Meet
│   │   │   ├── heygen-avatar.ts  # LiveAvatar session + LiveKit
│   │   │   └── media-inject.ts   # getUserMedia override, audio capture
│   │   │
│   │   ├── browser-agent/
│   │   │   └── agent.ts          # Playwright headless browser for tool actions
│   │   │
│   │   └── socket.ts             # Socket.IO event handlers
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # THE page (everything lives here)
│   │   │   └── layout.tsx        # App shell
│   │   │
│   │   ├── components/
│   │   │   ├── LiveTranscript.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   └── StatusBadge.tsx
│   │   │
│   │   └── hooks/
│   │       └── useSocket.ts      # Socket.IO client
│   │
│   ├── package.json
│   └── tailwind.config.ts
│
├── .env.example
└── package.json
```

## System Prompts (hardcoded in `system-prompt.ts`)

### Phone Mode

```
You are {user_name}'s AI phone twin. You ARE {user_name} — never reveal you're an AI.

PERSONALITY:
- Casual, uses filler words: "uh", "like", "yeah", "for sure"
- Keep responses SHORT (this is a phone call, not an essay)

CONTEXT:
- You're a student at Dartmouth studying CS
- Current project: capstone — auth middleware done, dashboard 80% complete

RULES:
- If you don't know something, say "let me check on that" and use tools
- If someone asks something you can't handle: "Hey can I call you back in 5?"

TOOLS:
You have tools to look things up. Say "hold on let me pull that up" while waiting.
```

### Meeting Mode

```
You are {user_name}'s AI avatar in a Google Meet meeting.
You ARE {user_name} — act naturally.

RULES:
- DO NOT speak on every message. This is a group meeting.
- ONLY respond when someone says your name or asks you directly.
- Keep responses to 1-2 sentences max.
- Natural phrases: "Yeah so...", "Quick update...", "I can add to that..."
- NEVER interrupt someone mid-sentence.

TOOLS:
Same tools available. Say "one sec let me check" while waiting.
```

## Environment Variables

```env
# .env

# Phone
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# STT
DEEPGRAM_API_KEY=

# LLM
GEMINI_API_KEY=

# TTS
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# Avatar
HEYGEN_API_KEY=
HEYGEN_AVATAR_ID=

# Server
SERVER_URL=                       # ngrok URL for Twilio webhook
PORT=3001
```

## Dev Setup

```bash
# 1. Install
cd phoneclone && npm install

# 2. Environment
cp .env.example .env              # fill in API keys

# 3. Clone your voice
# Record 1-5 min → upload to ElevenLabs → copy voice_id to .env

# 4. Get a Twilio phone number (~$1/month) → copy to .env

# 5. Expose server for Twilio webhooks
ngrok http 3001                   # copy URL to .env as SERVER_URL
# Set Twilio webhook: {ngrok_url}/api/twilio/voice

# 6. Run
npm run dev                       # server (3001) + dashboard (3000)

# 7. Test phone: call your Twilio number
# 8. Test meeting: paste a Google Meet URL in dashboard → "Join Now"
```
