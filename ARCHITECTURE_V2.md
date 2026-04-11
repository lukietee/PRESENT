# PhoneClone: AI Voice Agent + Meeting Avatar Architecture

> Never miss a call — or a meeting — again. Your AI twin picks up the phone AND shows up on camera.

---

## System Overview

Four interconnected components working together:

```
    Caller's Phone              Meeting (Zoom/Meet/Teams)
         │                              │
         ▼                              ▼
┌─────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│   VOICE AGENT   │      │   MEETING AVATAR     │      │    DASHBOARD     │
│  (Phone Mode)   │      │   (Video Mode)       │      │                  │
│                 │      │                      │      │ Next.js          │
│ Twilio (phone)  │      │ Playwright (join)    │      │ (monitoring +    │
│ Deepgram (STT)  │      │ Deepgram (STT)       │      │  approvals +     │
│ ElevenLabs(TTS) │      │ ElevenLabs (TTS)     │      │  scheduling)     │
│                 │      │ HeyGen LiveAvatar    │      │                  │
└────────┬────────┘      └──────────┬───────────┘      └────────┬─────────┘
         │                          │                           │
         └────────────┬─────────────┘                           │
                      ▼                                         │
           ┌────────────────────┐                               │
           │    SHARED BRAIN    │◄──────────────────────────────┘
           │                    │
           │ Gemini (LLM+tools) │
           │ Browser Agent      │
           │ System Prompt Eng. │
           └────────────────────┘
```

**Key Insight:** Phone calls and video meetings are just different I/O adapters plugged into the same brain. Gemini, the browser agent, and the tool system are shared — only the audio/video transport layer differs.

---

## Tech Stack

**Hackathon sponsor tracks:** Gemini (Google) + ElevenLabs

| Component | Technology | Why |
|-----------|-----------|-----|
| **Telephony** | Twilio Programmable Voice + Media Streams | Industry standard, WebSocket audio streaming, real phone numbers |
| **Speech-to-Text** | Deepgram (streaming + diarization) | ~300ms latency, WebSocket API, handles mu-law natively, speaker diarization for meetings |
| **LLM Brain** | Gemini 2.5 Pro (Google) | Streaming, function calling for browser agent, 1M+ context for meeting history, hackathon sponsor track |
| **Text-to-Speech** | ElevenLabs (WebSocket streaming, Turbo v2.5) | Voice cloning, low-latency streaming, natural sounding |
| **Avatar Video** | HeyGen LiveAvatar (LITE mode) | Real-time lip-synced photorealistic avatar, WebRTC delivery, 1 credit/min |
| **Avatar Transport** | LiveKit (WebRTC) | Low-latency video streaming from HeyGen to our system |
| **Meeting Join** | Playwright (headed/headless) | Join Zoom/Meet/Teams via browser, inject camera+mic streams |
| **Browser Automation** | Playwright | Headless Chrome, screenshots, full browser control for tool actions |
| **Backend** | Node.js + Express + Socket.IO | Fast WebSocket handling, good streaming ecosystem |
| **Frontend/Dashboard** | Next.js (App Router) + Tailwind + shadcn/ui on **Vercel** | Fast to build, great real-time support, instant deploys |
| **Database** | Neon Postgres (via Drizzle ORM) on **Vercel Marketplace** | Managed, serverless-friendly, free tier |
| **Auth** | Simple token/password (hackathon scope) | Just enough to protect the dashboard |

---

## Shared Brain Layer

The brain is session-agnostic. Both phone and meeting modes implement the same `Session` interface:

```typescript
interface Session {
  id: string;
  type: 'phone' | 'meeting';

  // Output: where generated audio goes
  sendAudio(pcmChunks: Buffer[]): void;

  // Transcript: for dashboard + context
  addMessage(msg: Message): void;

  // Interruption: caller/participant started talking
  onBargeIn(): void;

  // History: for Gemini context
  getConversationHistory(): Message[];

  // Metadata
  getSystemPrompt(): string;
  getParticipants(): Participant[];
}
```

**Phone mode** implements `sendAudio` by converting PCM → mu-law 8kHz → Twilio WebSocket.
**Meeting mode** implements `sendAudio` by:
1. Encoding PCM 16-bit 24kHz → base64 → HeyGen `agent.speak` WebSocket command (for lip sync)
2. Injecting the same audio into the meeting browser tab's microphone stream

### Orchestrator Flow (shared by both modes)

```typescript
class BrainOrchestrator {
  async handleTranscript(session: Session, transcript: string, speaker?: string) {
    // 1. Add to conversation history
    session.addMessage({ role: 'participant', content: transcript, speaker });

    // 2. Check if we should respond (always for phone, conditional for meetings)
    if (!this.shouldRespond(session, transcript)) return;

    // 3. Send to Gemini with streaming
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-pro',
      contents: session.getConversationHistory(),
      config: {
        systemInstruction: session.getSystemPrompt(),
        tools: [{ functionDeclarations: this.getAvailableTools() }]
      }
    });

    // 4. Stream response → sentence chunking → TTS → session output
    for await (const sentence of sentenceChunker(stream)) {
      const audio = await elevenlabs.synthesize(sentence);  // PCM 24kHz
      session.sendAudio(audio);
    }
  }
}
```

---

## Phone Mode: Detailed Call Flow

### What happens when someone calls your number:

```
Step 1: RING
────────────────────────────────────────────────────────
Caller dials your Twilio number
  → Twilio sends webhook to your server
  → Server creates call session in DB
  → Server responds with TwiML: <Connect><Stream>
  → Twilio opens WebSocket Media Stream
  → Dashboard receives "incoming call" via Socket.IO

Step 2: GREETING
────────────────────────────────────────────────────────
Server sends a natural greeting through ElevenLabs TTS:
  "Hey what's up" / "Yo" / "Hey man what's going on"
  (randomized from user-configured greetings)
  → Audio sent back through Twilio to caller

Step 3: CONVERSATION LOOP (repeats)
────────────────────────────────────────────────────────
Caller speaks
  → Twilio streams mu-law audio chunks via WebSocket
  → Server pipes audio → Deepgram streaming STT
  → Deepgram returns real-time transcript
  → Transcript streamed to Dashboard (live view)
  → Final transcript → BrainOrchestrator.handleTranscript()
  → Gemini responds (streaming tokens)
  → Tokens buffered into sentence chunks
  → Each sentence → ElevenLabs streaming TTS
  → TTS audio → converted to mu-law → Twilio → Caller
  → Response text streamed to Dashboard

IF Gemini needs information:
  → Gemini makes tool call (e.g., "check_google_drive")
  → Browser Agent receives task
  → Action sent to Dashboard for approval (if required)
  → User approves from Dashboard (or auto-approved)
  → Browser Agent executes action
  → Result returned to Gemini
  → Gemini incorporates info into response
  → Meanwhile, filler phrase plays: "Let me check on that real quick..."

Step 4: HANG UP
────────────────────────────────────────────────────────
Either party ends call
  → Full transcript saved to DB
  → Gemini generates call summary
  → Dashboard updated with completed call
  → Notification sent to user (optional)
```

---

## Voice Pipeline Deep Dive

### Latency Budget — Phone Mode (target: <1.5s)

```
Caller speaks → [audio travels] .............. ~100ms
Deepgram STT (streaming) ..................... ~300ms
Gemini API (time to first token) ............. ~500ms
Sentence buffer + ElevenLabs TTS ............. ~400ms
Audio back to caller ......................... ~100ms
                                         ─────────────
Total ........................................ ~1.4s
```

### Streaming Strategy

```
Gemini tokens:  "Sure, | let me | check | the | project. | It looks | like..."
                                             |
                             Sentence boundary detected
                                             |
                             ┌────────────────┘
                             ▼
                   ElevenLabs TTS starts
                   generating audio for
                   "Sure, let me check the project."
                   while Gemini keeps generating
```

Key: Don't wait for Gemini's full response. Detect sentence boundaries (`. ? ! ,` with buffer) and send each sentence to TTS immediately.

### Audio Format Conversion — Phone Mode

```
Twilio → Server:    mu-law 8kHz mono (base64 encoded)
Server → Deepgram:  mu-law 8kHz mono (Deepgram accepts this natively)
Server → Gemini:    text (from Deepgram transcript)
Gemini → Server:    text
Server → ElevenLabs: text → returns PCM 24kHz audio
ElevenLabs → Twilio: must convert PCM 24kHz → mu-law 8kHz base64
```

### ElevenLabs Voice Clone Setup

```
1. User records 1-5 minutes of natural speech
2. Upload via ElevenLabs "Instant Voice Cloning" API:
   POST /v1/voices/add
   - name: "my-clone"
   - files: [audio_samples]
3. Receive voice_id → store in .env
4. Use voice_id in all TTS calls
```

---

## Meeting Avatar Pipeline (HeyGen LiveAvatar)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Meeting Platform (Google Meet / Zoom / Teams)    │
│                                                                     │
│   What participants see:                                            │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│   │  Jake    │  │  Sarah   │  │ YOU(avatar)│ ← photorealistic      │
│   │  (real)  │  │  (real)  │  │ lip-synced │   video of your face  │
│   └──────────┘  └──────────┘  └──────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
         │ audio from participants          ▲ avatar video + TTS audio
         ▼                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                Playwright Browser (Meeting Tab)                      │
│                                                                     │
│  - Joined meeting via URL                                           │
│  - getUserMedia overridden → injects avatar video + TTS as cam/mic  │
│  - Captures participant audio via Web Audio API                     │
└────────┬──────────────────────────────────────────────────────┬─────┘
         │ participant audio (PCM)                              ▲
         ▼                                                      │
┌─────────────────┐    ┌──────────────┐    ┌──────────────────────────┐
│ Deepgram STT    │    │    Gemini    │    │   HeyGen LiveAvatar      │
│ (streaming +    │───►│   (brain)    │───►│   (LITE mode)            │
│  diarization)   │    │              │    │                          │
│                 │    │  Tool calls  │    │  IN: base64 PCM audio    │
└─────────────────┘    │      │       │    │  OUT: WebRTC video       │
                       │      ▼       │    │       (LiveKit)          │
                       │ Browser Agent│    └──────────────────────────┘
                       └──────────────┘
```

### Meeting Join Flow

```
Step 1: SCHEDULE / TRIGGER
────────────────────────────────────────────────────────
User schedules meeting from Dashboard
  OR auto-detected from Google Calendar integration
  → Meeting record created in DB (status: 'scheduled')
  → At scheduled time (or user clicks "Join as Avatar"):

Step 2: JOIN MEETING
────────────────────────────────────────────────────────
Server launches Playwright (headed mode with Xvfb)
  → Navigate to meeting URL
  → Handle platform-specific join flow:
     Google Meet: click "Ask to join" / "Join now"
     Zoom Web: enter name, click "Join"
     Teams: click "Join on the web" → "Join now"
  → Before joining, override getUserMedia (see below)
  → Meeting joined → status: 'active'

Step 3: START HEYGEN AVATAR
────────────────────────────────────────────────────────
Simultaneously with Step 2:
  → POST /v1/sessions/token
    { mode: "LITE", avatar_id: HEYGEN_AVATAR_ID }
  → Receive session_token
  → POST /v1/sessions/start (with session_token)
  → Receive LiveKit room URL + token
  → Connect to LiveKit room via @livekit/rtc-node SDK
  → Receive avatar video track (WebRTC)
  → Start keep_alive interval (every 30s)
  → Status: avatar rendering ready

Step 4: WIRE UP STREAMS
────────────────────────────────────────────────────────
Avatar video (from LiveKit) → canvas element → MediaStream video track
ElevenLabs audio output → Web Audio API → MediaStream audio track
Combined MediaStream → injected as getUserMedia result
  → Meeting platform uses this as camera + microphone

Meeting participant audio → Web Audio API capture → PCM buffer
  → Piped to Deepgram streaming STT (with diarization enabled)

Step 5: CONVERSATION LOOP
────────────────────────────────────────────────────────
Participants speak
  → Deepgram returns transcript with speaker labels
  → "When to speak" logic evaluates (see below)
  → If triggered: BrainOrchestrator.handleTranscript()
  → Gemini generates response → ElevenLabs TTS (PCM 24kHz)
  → Audio sent two places:
     a) HeyGen WebSocket: agent.speak (base64 PCM) → lip-synced render
     b) Meeting browser: injected as mic audio
  → Avatar's mouth moves in sync with speech
  → Participants hear + see the response

Step 6: LEAVE MEETING
────────────────────────────────────────────────────────
User clicks "Leave" on Dashboard OR meeting ends
  → POST /v1/sessions/stop (HeyGen)
  → Playwright clicks "Leave meeting" button
  → Gemini generates meeting summary
  → Full transcript saved to DB
  → Dashboard updated
```

### getUserMedia Override (Camera + Mic Injection)

```typescript
// Injected into the meeting page BEFORE joining
await page.evaluate(() => {
  // Create a canvas for avatar video frames
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  // Create audio context for TTS injection
  const audioCtx = new AudioContext({ sampleRate: 48000 });
  const destination = audioCtx.createMediaStreamDestination();

  // Expose globals for our server to push frames/audio into
  window.__avatarCanvas = canvas;
  window.__avatarCtx = ctx;
  window.__audioDestination = destination;

  // Override getUserMedia
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    const tracks = [];

    if (constraints.video) {
      // Video track from canvas (avatar frames drawn here)
      const videoStream = canvas.captureStream(30); // 30fps
      tracks.push(videoStream.getVideoTracks()[0]);
    }

    if (constraints.audio) {
      // Audio track from Web Audio destination (TTS piped here)
      tracks.push(destination.stream.getAudioTracks()[0]);
    }

    return new MediaStream(tracks);
  };
});
```

### HeyGen LiveAvatar Session Management

```typescript
class LiveAvatarSession {
  private ws: WebSocket;
  private sessionId: string;
  private keepAliveInterval: NodeJS.Timer;

  // Lifecycle
  async create(avatarId: string): Promise<void> {
    // 1. Get session token
    const { session_token } = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.HEYGEN_API_KEY },
      body: JSON.stringify({
        mode: 'LITE',
        avatar_id: avatarId,
        video_settings: { quality: 'high', encoding: 'H264' }
      })
    }).then(r => r.json());

    // 2. Start session (returns LiveKit credentials)
    const { livekit_url, livekit_token } = await fetch(
      'https://api.liveavatar.com/v1/sessions/start',
      { headers: { Authorization: `Bearer ${session_token}` } }
    ).then(r => r.json());

    // 3. Connect WebSocket for commands
    this.ws = new WebSocket(/* session WebSocket URL */);

    // 4. Start keep-alive (session times out after ~5min idle)
    this.keepAliveInterval = setInterval(() => {
      this.ws.send(JSON.stringify({ type: 'session.keep_alive' }));
    }, 30000);
  }

  // Send audio for lip-synced playback
  speakAudio(pcmBuffer: Buffer): void {
    // PCM 16-bit 24kHz mono, base64 encoded, <=1MB per packet
    const chunks = chunkBuffer(pcmBuffer, 1024 * 1024);
    for (const chunk of chunks) {
      this.ws.send(JSON.stringify({
        type: 'agent.speak',
        data: { audio: chunk.toString('base64') }
      }));
    }
    this.ws.send(JSON.stringify({ type: 'agent.speak_end' }));
  }

  // Interrupt current speech
  interrupt(): void {
    this.ws.send(JSON.stringify({ type: 'agent.interrupt' }));
  }

  // Avatar visual state
  setListening(active: boolean): void {
    const type = active ? 'agent.start_listening' : 'agent.stop_listening';
    this.ws.send(JSON.stringify({ type }));
  }

  // Cleanup
  async stop(): Promise<void> {
    clearInterval(this.keepAliveInterval);
    await fetch('https://api.liveavatar.com/v1/sessions/stop', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.sessionToken}` }
    });
    this.ws.close();
  }
}
```

### Audio Format Conversion — Meeting Mode

```
Participants → Browser:   PCM 48kHz (Web Audio API capture)
Browser → Deepgram:       PCM 16kHz (downsampled for STT)
Gemini → ElevenLabs:      text → returns PCM 24kHz mono
ElevenLabs → HeyGen:      PCM 16-bit 24kHz mono, base64 (<=1MB packets)
ElevenLabs → Meeting mic: PCM 48kHz (upsampled via Web Audio API)
HeyGen → LiveKit:         H264 video stream (WebRTC)
LiveKit → Canvas:         Video frames drawn at 30fps
Canvas → Meeting camera:  MediaStream captureStream(30)
```

### Latency Budget — Meeting Mode (target: <2s)

```
Participant speaks → [WebRTC + browser capture] ... ~200ms
Deepgram STT (streaming + diarization) ........... ~400ms
Gemini API (time to first token) ................. ~500ms
Sentence buffer + ElevenLabs TTS ................. ~400ms
HeyGen LiveAvatar lip-sync render ................ ~200ms
WebRTC video back to meeting ..................... ~100ms
                                             ─────────────
Total ............................................. ~1.8s
```

This is acceptable for meetings because:
- Group conversations have natural pauses between speakers (1-3s)
- The avatar shows a "listening" animation while processing (visual feedback)
- Meeting cadence is slower than 1-on-1 phone calls
- Participants expect slight delays in video calls anyway

### "When to Speak" Logic

Unlike phone calls (always respond), the meeting avatar needs intelligence about WHEN to speak:

```typescript
enum SpeakTrigger {
  DIRECTLY_ADDRESSED,     // "Hey Lucas, what do you think?"
  NAME_MENTIONED,         // "Lucas said he'd handle that" → clarify if needed
  QUESTION_TO_GROUP,      // "Does anyone know the status?" → avatar has info
  STANDUP_TURN,           // "Lucas, you're up" / round-robin detection
  LONG_SILENCE,           // 5s+ silence after a question directed at the group
}

function shouldRespond(session: MeetingSession, transcript: string): boolean {
  const userName = session.getUserName().toLowerCase();

  // Always respond if directly addressed
  if (transcript.toLowerCase().includes(userName)) return true;

  // Respond to direct questions when avatar has relevant context
  if (isQuestion(transcript) && avatarHasRelevantInfo(transcript)) return true;

  // Standup pattern: respond when it's our turn
  if (session.isStandup && isOurTurn(session)) return true;

  // Otherwise, stay quiet (don't dominate the meeting)
  return false;
}
```

System prompt addition for meeting mode:
```
MEETING MODE RULES:
- You are in a group meeting with multiple people. DO NOT speak on every message.
- Only speak when: someone says your name, asks you directly, or it's your turn.
- Keep responses VERY short (1-2 sentences max). Meetings move fast.
- If it's a standup, give your update concisely: what you did, what's next, blockers.
- Never interrupt someone mid-sentence.
- Use natural meeting phrases: "Yeah so...", "Quick update on that...", "I can chime in here..."
```

---

## Computer/Browser Agent

### Architecture (shared by both modes)

```
┌──────────────────────────────────────────────────┐
│              Gemini (Shared Brain)                │
│                                                  │
│  Tool calls:                                     │
│  ┌────────────────────────────────────────────┐  │
│  │ check_google_drive(project_name)           │  │
│  │ read_email(subject_filter)                 │  │
│  │ check_calendar(date_range)                 │  │
│  │ search_slack(query)                        │  │
│  │ check_github(repo, what)                   │  │
│  │ open_url(url)                              │  │
│  │ search_files(query)                        │  │
│  └────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│              Browser Agent Server                │
│                                                  │
│  1. Receive tool call from brain orchestrator    │
│  2. Classify action tier (see below)             │
│  3. If approval needed → push to Dashboard       │
│  4. Wait for approval OR auto-approve            │
│  5. Execute via Playwright (SEPARATE context     │
│     from the meeting browser tab)                │
│  6. Screenshot current state → Dashboard         │
│  7. Extract relevant info (Gemini multimodal/parse) │
│  8. Return structured result to brain            │
└──────────────────────────────────────────────────┘
```

**Important:** The browser agent uses a SEPARATE Playwright browser context from the meeting tab. Two contexts run simultaneously:
- Context 1: Meeting tab (camera/mic/audio capture)
- Context 2: Tool actions (Google Drive, Gmail, GitHub, etc.)

### Action Approval Tiers

| Tier | Actions | Approval |
|------|---------|----------|
| **Auto** | View/read anything (Drive, email, calendar, GitHub) | No approval needed |
| **Ask** | Send message, edit document, create file, post comment | Dashboard approval required |
| **Block** | Delete anything, financial actions, account changes | Always blocked, notify user |

---

## Dashboard Design

### Main Page — Unified Activity View (`/`)

```
┌─────────────────────────────────────────────────────────────┐
│  PhoneClone Dashboard                        [Settings]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACTIVE SESSIONS (2)                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [phone icon] Jake Morrison │ 3:42 │ PHONE │ ● LIVE   │  │
│  │                                                       │  │
│  │  Jake: "Hey can you check where we're at on the       │  │
│  │         capstone project?"                            │  │
│  │  You (AI): "Yeah for sure, let me pull that up..."    │  │
│  │                                                       │  │
│  │  [Approve Action] [Take Over] [End Call]              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [video icon] CS98 Standup │ 12:30 │ MEET │ ● LIVE    │  │
│  │                                                       │  │
│  │  [Avatar Preview]  Jake: "Lucas, what did you work on │  │
│  │  ┌──────────┐      yesterday?"                        │  │
│  │  │ (avatar  │     You (AI): "I pushed the auth        │  │
│  │  │  video)  │      middleware and fixed the CORS bug"  │  │
│  │  └──────────┘                                         │  │
│  │  3 participants │ Speaking: Jake                       │  │
│  │                                                       │  │
│  │  [Take Over] [Leave Meeting]                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  UPCOMING MEETINGS                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Team Sync     │ Today 2:00pm │ Zoom  │[Join Avatar]│    │
│  │  Office Hours  │ Today 4:30pm │ Meet  │[Join Avatar]│    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  RECENT ACTIVITY                                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  [phone] Mom         │ 12min │ Today 9:30am │ View  │    │
│  │  [video] Sprint Retro│ 28min │ Yesterday    │ View  │    │
│  │  [phone] Unknown     │ 0:30  │ Yesterday    │ View  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Meeting Detail Page (`/meeting/[id]`)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back │ CS98 Standup │ Google Meet │ 12:30 │ ● LIVE       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │                     │  │ TRANSCRIPT                    │ │
│  │   Avatar Preview    │  │                              │ │
│  │   (live video feed) │  │ Jake (12:31): "Alright let's │ │
│  │                     │  │   do quick updates. Sarah?"  │ │
│  │   State: LISTENING  │  │ Sarah (12:31): "I finished   │ │
│  │                     │  │   the frontend components"   │ │
│  └─────────────────────┘  │ Jake (12:32): "Lucas?"       │ │
│                           │ You (12:32): "Yeah so I      │ │
│  PARTICIPANTS (3)         │   pushed auth middleware..."  │ │
│  ● Jake Morrison          │                              │ │
│  ● Sarah Chen             │                              │ │
│  ● You (Avatar)           └──────────────────────────────┘ │
│                                                             │
│  ACTIONS                                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [auto] Checked GitHub commits (12:32) ✓              │  │
│  │ [auto] Checked Google Drive project doc (12:33) ✓    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [Type a response for avatar...]  [Take Over]  [Leave]      │
└─────────────────────────────────────────────────────────────┘
```

### Meeting Scheduler (`/meetings`)

```
┌─────────────────────────────────────────────────────────────┐
│  Schedule Avatar Attendance                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Meeting URL: [https://meet.google.com/abc-defg-hij    ]    │
│  Title:       [CS98 Weekly Standup                      ]    │
│  Platform:    (●) Google Meet  ( ) Zoom  ( ) Teams          │
│  When:        [Today] [2:00 PM]  OR  [ ] Join now           │
│  Behavior:    (●) Standup mode  ( ) Listener  ( ) Active    │
│                                                             │
│  [Schedule]                                                  │
│                                                             │
│  ─── OR sync from Google Calendar ───                       │
│  [Import from Calendar]                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- ═══════════════════════════════════════════
-- PHONE CALLS (existing)
-- ═══════════════════════════════════════════

CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  caller_number TEXT NOT NULL,
  caller_name TEXT,
  status TEXT DEFAULT 'active',     -- active | completed | missed
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  summary TEXT,
  duration_seconds INTEGER
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  call_id TEXT REFERENCES calls(id),
  role TEXT NOT NULL,                -- 'caller' | 'agent' | 'system'
  content TEXT NOT NULL,
  timestamp DATETIME NOT NULL
);

CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  call_id TEXT REFERENCES calls(id),
  tool_name TEXT NOT NULL,
  parameters TEXT,                  -- JSON
  tier TEXT NOT NULL,               -- 'auto' | 'ask' | 'block'
  status TEXT DEFAULT 'pending',    -- pending | approved | denied | completed | failed
  result TEXT,
  screenshot_path TEXT,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME
);

-- ═══════════════════════════════════════════
-- MEETINGS (new)
-- ═══════════════════════════════════════════

CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,            -- 'google_meet' | 'zoom' | 'teams'
  meeting_url TEXT NOT NULL,
  meeting_title TEXT,
  status TEXT DEFAULT 'scheduled',   -- scheduled | joining | active | ended | failed
  behavior_mode TEXT DEFAULT 'active', -- 'standup' | 'listener' | 'active'
  scheduled_at DATETIME,
  joined_at DATETIME,
  ended_at DATETIME,
  summary TEXT,
  heygen_session_id TEXT,
  duration_seconds INTEGER
);

CREATE TABLE meeting_messages (
  id TEXT PRIMARY KEY,
  meeting_id TEXT REFERENCES meetings(id),
  speaker TEXT,                      -- participant name (diarization) or 'avatar'
  role TEXT NOT NULL,                -- 'participant' | 'avatar' | 'system'
  content TEXT NOT NULL,
  timestamp DATETIME NOT NULL
);

CREATE TABLE meeting_actions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT REFERENCES meetings(id),
  tool_name TEXT NOT NULL,
  parameters TEXT,
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT,
  screenshot_path TEXT,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME
);

-- ═══════════════════════════════════════════
-- SHARED
-- ═══════════════════════════════════════════

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE,
  name TEXT NOT NULL,
  relationship TEXT,
  context TEXT,
  auto_approve_tier TEXT DEFAULT 'auto'
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## Real-time Communication Map

```
┌─────────┐  WebSocket   ┌──────────┐  Socket.IO  ┌───────────┐
│ Twilio  │◄────────────►│          │◄───────────►│           │
└─────────┘  (audio)     │          │  (events)   │ Dashboard │
                         │  Server  │             │           │
┌─────────┐  WebSocket   │          │             │           │
│ HeyGen  │◄────────────►│          │             │           │
└─────────┘  (commands)  └────┬─────┘             └───────────┘
                              │
┌─────────┐  WebRTC          │
│ LiveKit │◄─────────────────┘ (avatar video)
└─────────┘

Socket.IO Events:
──────────────────────────────────────────────────────────────

PHONE EVENTS (server → dashboard):
├── 'call:start'           → new call incoming
├── 'call:end'             → call ended
├── 'call:transcript'      → new message in transcript
├── 'call:action_request'  → browser agent needs approval
├── 'call:action_result'   → action completed
└── 'call:summary'         → post-call summary ready

MEETING EVENTS (server → dashboard):
├── 'meeting:scheduled'    → new meeting queued
├── 'meeting:joining'      → avatar is connecting to meeting
├── 'meeting:active'       → avatar successfully in meeting
├── 'meeting:ended'        → meeting session ended
├── 'meeting:transcript'   → new line (with speaker label)
├── 'meeting:avatar_state' → avatar speaking / listening / idle
├── 'meeting:participants' → participant join/leave
├── 'meeting:action_request' → same approval flow as phone
└── 'meeting:action_result'  → action completed

DASHBOARD → SERVER:
├── 'call:approve_action'  → user approved browser action
├── 'call:deny_action'     → user denied action
├── 'call:takeover'        → user takes over phone call
├── 'call:end'             → user ends call
├── 'meeting:schedule'     → schedule avatar for a meeting
├── 'meeting:join_now'     → join a meeting immediately
├── 'meeting:leave'        → avatar leaves meeting
├── 'meeting:takeover'     → user wants to join manually
├── 'meeting:send_message' → user types a response for avatar
└── 'meeting:approve_action' → approve browser action in meeting
```

---

## Project Structure

```
phoneclone/
├── server/
│   ├── src/
│   │   ├── index.ts                 # Express app entry point
│   │   ├── config.ts                # Environment + constants
│   │   │
│   │   ├── brain/                   # Shared orchestration layer
│   │   │   ├── orchestrator.ts      # Mode-agnostic conversation loop
│   │   │   ├── gemini.ts             # Gemini API with streaming + function calling
│   │   │   ├── system-prompt.ts     # Dynamic system prompt builder
│   │   │   ├── tools.ts             # Tool definitions for browser agent
│   │   │   └── session.ts           # Session interface + types
│   │   │
│   │   ├── phone/                   # Phone mode I/O adapter
│   │   │   ├── phone-session.ts     # Implements Session interface
│   │   │   ├── twilio-webhook.ts    # Handle incoming call webhooks
│   │   │   ├── media-stream.ts      # WebSocket audio streaming
│   │   │   ├── deepgram-stt.ts      # Streaming speech-to-text
│   │   │   ├── elevenlabs-tts.ts    # Streaming text-to-speech
│   │   │   └── audio-utils.ts       # mu-law conversion, chunking
│   │   │
│   │   ├── meeting/                 # Meeting mode I/O adapter
│   │   │   ├── meeting-session.ts   # Implements Session interface
│   │   │   ├── meeting-joiner.ts    # Playwright: join Zoom/Meet/Teams
│   │   │   ├── audio-capture.ts     # Web Audio API: capture participant audio
│   │   │   ├── audio-inject.ts      # Inject TTS audio into meeting mic
│   │   │   ├── heygen-avatar.ts     # LiveAvatar LITE session management
│   │   │   ├── livekit-client.ts    # Receive avatar video from LiveKit
│   │   │   ├── video-inject.ts      # Feed avatar video frames to canvas
│   │   │   └── speak-logic.ts       # "When to speak" decision engine
│   │   │
│   │   ├── browser-agent/           # Tool execution (shared)
│   │   │   ├── agent.ts             # Playwright browser controller
│   │   │   ├── actions.ts           # Action implementations
│   │   │   └── approval.ts          # Approval tier logic
│   │   │
│   │   ├── realtime/
│   │   │   └── socket.ts            # Socket.IO: phone + meeting events
│   │   │
│   │   ├── db/
│   │   │   ├── schema.ts            # Drizzle schema (calls + meetings)
│   │   │   └── index.ts             # DB connection + queries
│   │   │
│   │   └── routes/
│   │       ├── calls.ts             # GET /api/calls, GET /api/calls/:id
│   │       ├── meetings.ts          # CRUD meetings, schedule, join
│   │       ├── actions.ts           # POST /api/actions/:id/approve
│   │       ├── contacts.ts          # CRUD contacts
│   │       └── settings.ts          # CRUD settings
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Unified activity view (calls + meetings)
│   │   │   ├── call/[id]/page.tsx   # Call detail view
│   │   │   ├── meeting/[id]/page.tsx # Meeting detail view (NEW)
│   │   │   ├── meetings/page.tsx    # Schedule + manage meetings (NEW)
│   │   │   ├── history/page.tsx     # All past calls + meetings
│   │   │   ├── settings/page.tsx    # User settings + avatar config
│   │   │   └── layout.tsx           # App shell
│   │   │
│   │   ├── components/
│   │   │   ├── LiveTranscript.tsx   # Real-time scrolling transcript (shared)
│   │   │   ├── ActionApproval.tsx   # Approve/deny card (shared)
│   │   │   ├── CallCard.tsx         # Phone call session card
│   │   │   ├── MeetingCard.tsx      # Meeting session card (NEW)
│   │   │   ├── AvatarPreview.tsx    # Live avatar video embed (NEW)
│   │   │   ├── MeetingScheduler.tsx # Schedule meeting form (NEW)
│   │   │   ├── ParticipantList.tsx  # Meeting participants (NEW)
│   │   │   ├── BrowserPreview.tsx   # Browser agent screenshot viewer
│   │   │   └── StatusBadge.tsx      # Session status indicator
│   │   │
│   │   ├── hooks/
│   │   │   ├── useSocket.ts         # Socket.IO client hook
│   │   │   ├── useCalls.ts          # Call data fetching
│   │   │   └── useMeetings.ts       # Meeting data fetching (NEW)
│   │   │
│   │   └── lib/
│   │       └── api.ts               # API client
│   │
│   ├── package.json
│   └── tailwind.config.ts
│
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

---

## System Prompt Strategy

### Phone Mode Prompt

```
You are {user_name}'s AI phone twin. You ARE {user_name} — never break
character or reveal you're an AI.

PERSONALITY:
- Speech style: {casual/formal}, uses phrases like: {phrases}
- Tone: {friendly, chill, professional, etc.}
- Common greetings: {yo, hey, what's up, etc.}

CURRENT CONTEXT:
- You're a {year} at Dartmouth studying {major}
- Current classes: {list}
- Current projects: {list with status}

CONTACTS (who might call):
- {name}: {relationship}, {context}

RULES:
- Keep responses SHORT and natural (this is a phone call, not an essay)
- Use filler words naturally: "uh", "like", "yeah", "for sure"
- If you don't know something, say "let me check on that" and use tools
- Never share: {sensitive info rules}
- If someone asks something you truly can't handle: "Hey can I call you
  back in like 5 minutes? I'm in the middle of something"

TOOLS:
You have browser tools to look things up. When you use them, say something
natural like "hold on let me pull that up" to fill the gap.
```

### Meeting Mode Prompt

```
You are {user_name}'s AI avatar attending a meeting on their behalf.
You ARE {user_name} — act naturally as if you're really in this meeting.

MEETING: {meeting_title}
PLATFORM: {google_meet / zoom / teams}
BEHAVIOR: {standup / listener / active}
PARTICIPANTS: {known participant names if available}

PERSONALITY:
- Same speech patterns as phone mode but MORE concise
- Meeting-appropriate energy: engaged but brief

RULES:
- DO NOT speak on every message. This is a group meeting.
- ONLY respond when:
  • Someone says your name
  • You're directly asked a question
  • It's your turn (standup round-robin)
  • You have critical info that's being discussed incorrectly
- Keep responses to 1-2 sentences max. Meetings move fast.
- Natural meeting phrases: "Yeah so...", "Quick update...", "I can add to that..."
- If it's a standup: give concise update (yesterday, today, blockers)
- NEVER interrupt someone mid-sentence

STANDUP FORMAT (if behavior=standup):
When it's your turn, structure as:
"Yesterday I [what you did]. Today I'm working on [plan]. No blockers."
Use tools to pull real data (GitHub commits, Drive docs) for your update.

TOOLS:
Same browser tools available. When looking something up, say
"one sec let me check" — but keep it brief, this is a meeting.
```

---

## API Keys Needed

```env
# .env

# ── Phone Mode ──
TWILIO_ACCOUNT_SID=              # Twilio Console → Account SID
TWILIO_AUTH_TOKEN=                # Twilio Console → Auth Token
TWILIO_PHONE_NUMBER=              # Buy a number (~$1/month)

DEEPGRAM_API_KEY=                 # deepgram.com → free tier available

GEMINI_API_KEY=                   # aistudio.google.com → API keys

ELEVENLABS_API_KEY=               # elevenlabs.io
ELEVENLABS_VOICE_ID=              # After cloning your voice

# ── Meeting Mode (NEW) ──
HEYGEN_API_KEY=                   # app.liveavatar.com → Developers → API Key
HEYGEN_AVATAR_ID=                 # Your avatar ID (custom or stock)
                                  # Sandbox: dd73ea75-1218-4ef3-92ce-606d5f7fbc0a
HEYGEN_IS_SANDBOX=false           # true = free testing (Wayne avatar, ~1min sessions)

# ── Shared ──
SERVER_URL=                       # Your public URL (ngrok for dev)
DASHBOARD_SECRET=                 # Simple auth token for dashboard
```

---

## Development Setup

```bash
# 1. Clone and install
git clone <repo>
cd phoneclone
npm install                       # installs both server + dashboard

# 2. Set up environment
cp .env.example .env              # fill in API keys

# 3. Clone your voice (ElevenLabs)
# Record 1-5 min of yourself talking naturally
# Upload via ElevenLabs dashboard or API
# Copy voice_id to .env

# 4. Set up HeyGen avatar (NEW)
# Option A: Use sandbox for testing (no credits needed)
#   → Set HEYGEN_IS_SANDBOX=true (uses Wayne avatar, ~1min sessions)
# Option B: Use $100 hackathon credits
#   → Sign up at app.liveavatar.com
#   → Fill out Tally form: https://tally.so/r/68v8vk
#   → Create/select avatar → copy avatar_id to .env
#   → Get API key from Developers page → copy to .env

# 5. Get a phone number
# Twilio Console → Buy a number → copy to .env

# 6. Expose local server (for Twilio webhooks)
ngrok http 3001                   # copy URL to .env as SERVER_URL
# Configure Twilio webhook: {ngrok_url}/api/twilio/voice

# 7. Run
npm run dev                       # starts server (3001) + dashboard (3000)

# 8. Test phone mode
# Call your Twilio number from any phone!

# 9. Test meeting mode (NEW)
# Open dashboard → Meetings → paste a Google Meet URL → "Join Now"
# Watch the avatar appear in the meeting with your face
```

---

## Deployment Architecture

The system is split across two deployment targets based on runtime requirements:

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                   │
│                                                                  │
│  Next.js Dashboard (App Router)                                  │
│  ├── Pages: /, /call/[id], /meeting/[id], /meetings, /settings  │
│  ├── API routes: proxy to backend server                         │
│  ├── SSE/polling for real-time updates                           │
│  └── Auth, static assets, SSR                                    │
│                                                                  │
│  Neon Postgres (via Vercel Marketplace)                          │
│  └── calls, meetings, transcripts, contacts, settings            │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│               DEDICATED SERVER (Railway / Fly.io / VPS)          │
│                                                                  │
│  Node.js + Express + Socket.IO                                   │
│  ├── Twilio Media Streams (persistent WebSocket)                 │
│  ├── Deepgram STT (persistent WebSocket per session)             │
│  ├── ElevenLabs TTS (persistent WebSocket per session)           │
│  ├── Gemini orchestrator (streaming + function calling)          │
│  ├── HeyGen LiveAvatar (WebSocket + LiveKit WebRTC)              │
│  ├── Playwright browser instances (meeting join + browser agent) │
│  └── Socket.IO server (real-time events to dashboard)            │
└─────────────────────────────────────────────────────────────────┘
```

**Why the split:**
- Vercel Functions have a 300s max timeout — phone calls and meetings can last minutes to hours
- Persistent WebSocket connections (Twilio, Deepgram, ElevenLabs, HeyGen) need a long-lived server process
- Playwright requires a running browser instance (headed mode with Xvfb for meetings)
- The dashboard is a perfect fit for Vercel: SSR, API routes, instant deploys, preview URLs

---

## Team Split

### Person A: Dashboard + Frontend (Vercel)
- Next.js app setup and deployment on Vercel
- All dashboard pages and components (real-time monitoring, transcript view, approval flow)
- Meeting scheduler UI + Google Calendar integration
- Database schema + Drizzle ORM setup (Neon Postgres)
- Auth implementation
- API client for communicating with backend server
- Socket.IO / SSE client for live updates

### Person B: Voice Pipeline + Backend (Dedicated Server)
- Node.js + Express server setup and deployment
- Twilio webhook + media stream handling
- Deepgram STT streaming integration
- ElevenLabs TTS streaming + voice clone setup
- Gemini orchestrator (system prompt engineering, function calling, sentence chunking)
- Playwright meeting join + getUserMedia injection
- HeyGen LiveAvatar session management + LiveKit video
- Browser agent (Playwright tool execution)
- Socket.IO server (emit events to dashboard)

### Define Together First
- **API contract:** REST endpoints + Socket.IO event names/payloads between dashboard and backend
- **Database schema:** Agree on tables so both sides can read/write
- **Session interface:** The shared `Session` type that both modes implement

---

## Hackathon MVP Priorities

### Must Have (Demo-ready)

| # | Feature | Mode |
|---|---------|------|
| 1 | Voice pipeline end-to-end (call → Deepgram STT → Gemini → ElevenLabs TTS → response) | Phone |
| 2 | ElevenLabs voice clone sounding natural on phone | Phone |
| 3 | At least one browser agent action (Google Drive lookup) | Shared |
| 4 | Dashboard showing live transcript + action approvals | Shared |
| 5 | HeyGen LiveAvatar lip-synced to ElevenLabs audio output | Meeting |
| 6 | Join Google Meet via Playwright + inject avatar as camera | Meeting |
| 7 | Capture meeting audio → STT → Gemini responds when addressed | Meeting |
| 8 | Dashboard shows both phone calls and meetings simultaneously | Shared |

### Nice to Have

| # | Feature | Mode |
|---|---------|------|
| 9 | Speaker diarization in meetings (who said what) | Meeting |
| 10 | Calendar auto-detect + "Join as Avatar" prompt | Meeting |
| 11 | Call/meeting history with AI summaries | Shared |
| 12 | Contact recognition (different behavior per person) | Phone |
| 13 | "Take over" button (open meeting URL or take phone call) | Shared |
| 14 | Standup mode (auto-detect round-robin, give status update) | Meeting |

### Polish (if time)

| # | Feature | Mode |
|---|---------|------|
| 15 | Avatar video preview in dashboard | Meeting |
| 16 | Multiple simultaneous sessions (phone + meeting at once) | Shared |
| 17 | Mobile-responsive dashboard + push notifications | Shared |
| 18 | Meeting chat integration (respond in text too) | Meeting |
| 19 | Custom HeyGen avatar from user's video (full face clone) | Meeting |

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Voice latency too high** | Unnatural phone conversation | Pipeline streaming at every stage, filler phrases, sentence chunking |
| **ElevenLabs doesn't sound like user** | Breaks immersion | High quality samples, tune stability/clarity, phone audio masks imperfections |
| **getUserMedia override fails on Meet/Zoom update** | No avatar camera in meeting | Fallback: OBS virtual camera + virtual audio device at OS level |
| **Meeting platform blocks headless browser** | Can't join meeting | Use headed Playwright with Xvfb, stealth plugin, realistic user-agent |
| **HeyGen avatar video latency** | Lip sync visibly delayed | Use H264 encoding, `high` quality setting, pre-warm session before join |
| **HeyGen session timeout (5min idle)** | Avatar disconnects mid-meeting | `session.keep_alive` every 30s, auto-reconnect on disconnect |
| **Multiple speakers talking simultaneously** | Confused STT / wrong responses | Deepgram diarization, only respond when name detected, debounce |
| **Browser agent too slow during meeting** | Awkward silence while looking things up | Shorter filler phrase ("one sec"), cache recent lookups, parallel tool execution |
| **Twilio webhook needs public URL** | Can't test phone mode locally | ngrok for dev, Railway/Fly.io for demo |
| **Gemini function calls during meeting** | Avatar stays silent too long | Start response immediately, append tool results as follow-up sentence |

---

## Demo Script

> "What if you never had to miss a call OR a meeting again?"

### Act 1: The Phone Call (1 minute)

1. Show dashboard — empty, waiting
2. Call the Twilio number from another phone
3. Quick exchange: "Hey, where are we on the capstone?"
4. AI responds naturally in your cloned voice
5. Browser agent checks Google Drive, relays project status
6. End call — summary appears

> "That's the phone. But what about the 9am standup I slept through?"

### Act 2: The Meeting Avatar (2-3 minutes) ← Main Event

1. Show dashboard: "CS98 Daily Standup" scheduled for now
2. Click "Join as Avatar"
3. Switch view to the actual Google Meet (on another laptop/screen):
   - Participants see your avatar appear on camera — photorealistic, your face
   - Avatar's eyes blink, head moves slightly (idle animation)
4. A teammate says: "Lucas, what did you work on yesterday?"
5. Avatar's mouth moves perfectly in sync as it responds:
   "Yeah so yesterday I pushed the auth middleware and fixed that CORS bug we were dealing with. Today I'm gonna finish the dashboard and open a PR. No blockers."
6. Dashboard shows: live multi-speaker transcript, GitHub lookup (auto-approved), avatar state
7. Another participant: "Can you check if my branch has conflicts?"
8. Avatar: "One sec let me check... yeah you've got two conflicts in routes/auth.js and middleware/cors.js."
9. Meeting continues, avatar stays quiet when not addressed

> "I was asleep the whole time. My avatar handled standup, gave a real status update with real data, and nobody knew the difference."

### Act 3: The Unified View (30 seconds)

1. Show dashboard with BOTH active:
   - A phone call from Mom (asking about dinner plans)
   - The standup meeting still running
2. Same brain, same tools, two completely different modes
3. "PhoneClone. Never miss a call — or a meeting — again."

---

## Future Vision (Beyond Hackathon)

- **Lecture mode:** Avatar attends class, takes notes, asks questions you pre-write
- **Interview prep:** Avatar does mock interviews and you review the transcript
- **Office hours:** Avatar waits in queue, asks your prepared questions
- **Timezone bridge:** Avatar attends meetings at 3am for your overseas team
- **Multi-avatar:** Different appearance/tone for different contexts (professional vs casual)
- **Learning loop:** Avatar improves its mimicry of your speaking style over time from call transcripts
