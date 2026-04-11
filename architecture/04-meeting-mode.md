# Meeting Avatar Mode (HeyGen LiveAvatar)

**Google Meet only for MVP.** Zoom/Teams use the same pipeline — just different Playwright join logic.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Google Meet                                      │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│   │  Jake    │  │  Sarah   │  │ YOU(avatar)│ ← lip-synced avatar   │
│   └──────────┘  └──────────┘  └──────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
         │ participant audio                ▲ avatar video + TTS audio
         ▼                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                Playwright Browser (Meeting Tab)                      │
│  - getUserMedia overridden → injects avatar video + TTS as cam/mic  │
│  - Captures participant audio via Web Audio API                     │
└────────┬──────────────────────────────────────────────────────┬─────┘
         │ participant audio (PCM)                              ▲
         ▼                                                      │
┌─────────────────┐    ┌──────────────┐    ┌──────────────────────────┐
│ Deepgram STT    │───►│   Gemini     │───►│   HeyGen LiveAvatar      │
│ (streaming)     │    │   (brain)    │    │   (LITE mode)            │
└─────────────────┘    └──────────────┘    └──────────────────────────┘
```

## Flow

```
Step 1: User pastes Google Meet URL → clicks "Join Now" on dashboard
  → Socket.IO: meeting:join_now { url }

Step 2: JOIN MEETING
  → Server launches Playwright (headed mode with Xvfb)
  → Navigate to Meet URL
  → Override getUserMedia (see below)
  → Click "Ask to join" / "Join now"
  → Dashboard receives "meeting:active"

Step 3: START HEYGEN AVATAR (simultaneous with Step 2)
  → POST /v1/sessions/token { mode: "LITE", avatar_id }
  → POST /v1/sessions/start → get LiveKit room URL + token
  → Connect to LiveKit room → receive avatar video track
  → Start keep_alive interval (every 30s)

Step 4: WIRE UP STREAMS
  Avatar video (LiveKit) → canvas → MediaStream video track
  ElevenLabs audio → Web Audio API → MediaStream audio track
  Combined → injected as getUserMedia → Meeting uses as cam/mic

  Meeting participant audio → Web Audio API capture → PCM
  → Piped to Deepgram streaming STT

Step 5: CONVERSATION LOOP
  Participants speak → Deepgram transcript
  → If transcript contains user's name → BrainOrchestrator responds
  → Gemini → ElevenLabs TTS → sent to HeyGen (lip sync) + meeting mic
  → Avatar speaks with synced lip movement

Step 6: LEAVE
  User clicks "Leave" on dashboard
  → Kill HeyGen session + Playwright browser
```

## getUserMedia Override (Camera + Mic Injection)

```typescript
await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  const audioCtx = new AudioContext({ sampleRate: 48000 });
  const destination = audioCtx.createMediaStreamDestination();

  window.__avatarCanvas = canvas;
  window.__avatarCtx = ctx;
  window.__audioDestination = destination;

  navigator.mediaDevices.getUserMedia = async (constraints) => {
    const tracks = [];
    if (constraints.video) {
      tracks.push(canvas.captureStream(30).getVideoTracks()[0]);
    }
    if (constraints.audio) {
      tracks.push(destination.stream.getAudioTracks()[0]);
    }
    return new MediaStream(tracks);
  };
});
```

## HeyGen LiveAvatar Session (simplified)

```typescript
class LiveAvatarSession {
  private ws: WebSocket;
  private keepAliveInterval: NodeJS.Timer;

  async create(avatarId: string): Promise<{ livekitUrl: string; livekitToken: string }> {
    const { session_token } = await fetch('https://api.liveavatar.com/v1/sessions/token', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.HEYGEN_API_KEY },
      body: JSON.stringify({ mode: 'LITE', avatar_id: avatarId })
    }).then(r => r.json());

    const { livekit_url, livekit_token } = await fetch(
      'https://api.liveavatar.com/v1/sessions/start',
      { headers: { Authorization: `Bearer ${session_token}` } }
    ).then(r => r.json());

    this.ws = new WebSocket(/* session WebSocket URL */);
    this.keepAliveInterval = setInterval(() => {
      this.ws.send(JSON.stringify({ type: 'session.keep_alive' }));
    }, 30000);

    return { livekitUrl: livekit_url, livekitToken: livekit_token };
  }

  speakAudio(pcmBuffer: Buffer): void {
    const chunks = chunkBuffer(pcmBuffer, 1024 * 1024);
    for (const chunk of chunks) {
      this.ws.send(JSON.stringify({
        type: 'agent.speak',
        data: { audio: chunk.toString('base64') }
      }));
    }
    this.ws.send(JSON.stringify({ type: 'agent.speak_end' }));
  }

  async stop(): Promise<void> {
    clearInterval(this.keepAliveInterval);
    this.ws.close();
  }
}
```

## Audio Formats — Meeting Mode

```
Participants → Browser:   PCM 48kHz (Web Audio API capture)
Browser → Deepgram:       PCM 16kHz (downsampled)
Gemini → ElevenLabs:      text → PCM 24kHz mono
ElevenLabs → HeyGen:      PCM 16-bit 24kHz mono, base64
ElevenLabs → Meeting mic: PCM 48kHz (upsampled via Web Audio)
HeyGen → LiveKit → Canvas → Meeting camera: 30fps video
```

## Latency Budget (target: <2s)

```
Participant speaks → [capture] ................. ~200ms
Deepgram STT (streaming) ...................... ~400ms
Gemini API (time to first token) .............. ~500ms
Sentence buffer + ElevenLabs TTS .............. ~400ms
HeyGen lip-sync render ........................ ~200ms
Video back to meeting ......................... ~100ms
                                           ─────────────
Total .......................................... ~1.8s
```

Acceptable for meetings — group conversations have natural pauses between speakers.
