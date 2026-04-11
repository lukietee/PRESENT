# Deployment & Team Split

## Deployment (keep it simple)

**For the hackathon: run everything locally.** Don't spend time debugging cloud deployments.

```
Your laptop:
  ├── Server (localhost:3001)     — Node.js + Express + Socket.IO
  ├── Dashboard (localhost:3000)  — Next.js dev server
  └── ngrok (public URL)          — Twilio webhook only
```

If you need to deploy for judging:
- Dashboard → Vercel (free, instant)
- Server → Railway (free tier, supports WebSockets)

## Team Split

### Person A: Dashboard + Frontend
1. Scaffold Next.js + Tailwind + shadcn/ui
2. Build the single-page dashboard (SessionCard, LiveTranscript, StatusBadge)
3. Implement `useSocket` hook for Socket.IO client
4. Wire up "Join Meeting" input → `meeting:join_now` event
5. Wire up "End Call" / "Leave Meeting" buttons
6. **Make it look polished** — this is what judges see on screen

**Estimated time: 3-4 hours, then help Person B.**

### Person B: Voice Pipeline + Backend
1. Set up Express + Socket.IO server
2. Twilio webhook + media stream → Deepgram STT pipeline
3. Gemini orchestrator with streaming + function calling
4. ElevenLabs TTS streaming + mu-law conversion back to Twilio
5. Browser agent (separate headless Playwright for tool actions)
6. Playwright Google Meet join + getUserMedia override
7. HeyGen LiveAvatar session → LiveKit video → canvas injection
8. Wire up meeting audio capture → Deepgram → orchestrator

**Estimated time: 8-10 hours. This is the harder side — Person A should help after finishing.**

### First 30 Minutes Together
Agree on the Socket.IO event contract (see [07-api-contract.md](./07-api-contract.md)). That's the only interface between your two codebases. Once agreed, you can work independently.

### Build Order (Person B)
Start with phone mode — it's simpler and proves the core pipeline works:
1. Twilio → Deepgram → Gemini → ElevenLabs → Twilio (phone call works end-to-end)
2. Then add meeting mode on top (same brain, different I/O)
