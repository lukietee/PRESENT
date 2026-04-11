# PhoneClone: Hackathon MVP Architecture

> Never miss a call — or a meeting — again. Your AI twin picks up the phone AND shows up on camera.

## System Overview

```
    Caller's Phone              Meeting (Google Meet)
         │                              │
         ▼                              ▼
┌─────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│   VOICE AGENT   │      │   MEETING AVATAR     │      │    DASHBOARD     │
│  (Phone Mode)   │      │   (Video Mode)       │      │                  │
│                 │      │                      │      │ Next.js (1 page) │
│ Twilio (phone)  │      │ Playwright (join)    │      │ live transcript  │
│ Deepgram (STT)  │      │ Deepgram (STT)       │      │ + join meeting   │
│ ElevenLabs(TTS) │      │ ElevenLabs (TTS)     │      │                  │
│                 │      │ HeyGen LiveAvatar    │      │                  │
└────────┬────────┘      └──────────┬───────────┘      └────────┬─────────┘
         │                          │                           │
         └────────────┬─────────────┘                           │
                      ▼                                         │
           ┌────────────────────┐                               │
           │    SHARED BRAIN    │◄──────────────────────────────┘
           │                    │        Socket.IO
           │ Gemini (LLM)      │
           │ Browser Agent     │
           └────────────────────┘
```

**Key Insight:** Phone calls and video meetings are just different I/O adapters plugged into the same brain.

## Architecture Docs

| Doc | Description |
|-----|-------------|
| [Tech Stack](./01-tech-stack.md) | Technologies and sponsor tracks |
| [Shared Brain](./02-shared-brain.md) | Session interface, Gemini orchestrator |
| [Phone Mode](./03-phone-mode.md) | Twilio call flow, voice pipeline |
| [Meeting Mode](./04-meeting-mode.md) | HeyGen avatar, Playwright Google Meet join |
| [Browser Agent](./05-browser-agent.md) | Playwright tool execution for real lookups |
| [Dashboard](./06-dashboard.md) | Single-page UI with live transcripts |
| [API Contract](./07-api-contract.md) | Socket.IO events between dashboard and server |
| [Project Structure](./08-project-structure.md) | File tree, env vars, dev setup |
| [Deployment & Team](./09-deployment-team.md) | Local dev setup, team split |
| [Hackathon Plan](./10-hackathon-plan.md) | MVP checklist, risks, demo script |
