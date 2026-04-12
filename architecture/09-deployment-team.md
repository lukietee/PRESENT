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

---

## Hour 0: Setup Together (30 min)

Both people sit together for 30 minutes before splitting off.

**Do this together:**

1. Create the monorepo with `server/` and `dashboard/` folders
2. Initialize both projects (Express + Next.js)
3. Set up shared `.env` with all API keys
4. **Agree on the Socket.IO event contract** (see [07-api-contract.md](./07-api-contract.md))
5. Person B: set up Express + Socket.IO server with a test event
6. Person A: connect to it from Next.js with `useSocket` hook
7. Verify a test event flows from server → dashboard on screen

Once you see a message appear on the dashboard from the server, split up.

---

## Parallel Timeline

```
HOUR    PERSON A (Frontend)                  PERSON B (Backend)
─────   ──────────────────────               ──────────────────────
 0      ┌─────────────────────────── TOGETHER: scaffold + socket test ──┐
 0.5    │                                                               │
        └───────────────────────────────────────────────────────────────┘

 0.5    Build SessionCard +                  Twilio webhook handler
        LiveTranscript + StatusBadge         + media stream WebSocket
        components                           (receive audio from caller)

 1.5    Wire up page.tsx with mock           Deepgram STT streaming
        data — call card + meeting           (pipe Twilio audio → text)
        card rendering correctly

 2      useSocket hook: listen to            Gemini orchestrator
        call:start, call:transcript,         (send transcript → get
        call:end events and update           streaming response)
        React state

 3      "Join Meeting" URL input +           ElevenLabs TTS streaming
        meeting:join_now emit +              + mu-law conversion
        meeting:joining/active/ended         back to Twilio
        state handling
                                             ════════════════════════
                                             MILESTONE: phone call
                                             works end-to-end.
                                             Test by calling Twilio #

 4      Polish UI: dark mode,                Browser agent (Playwright
        animations, typography,              headless). Wire into
        responsive layout                    Gemini function calling.

 5      ┌──────────────────────── SYNC: test phone call with real dashboard ─┐
        │ Person B calls Twilio number                                       │
        │ Person A watches dashboard update live                             │
        │ Fix any event format mismatches                                    │
        └───────────────────────────────────────────────────────────────────-┘

 5.5    A helps B from here.                 Playwright: join Google
        Options:                             Meet + getUserMedia
        - Write system prompts               override (camera+mic
        - Test + debug phone flow            injection)
        - Handle edge cases in UI

 7      A helps with meeting mode:           HeyGen LiveAvatar session
        test Google Meet join,               → LiveKit video receive
        report bugs, tune prompts            → canvas → meeting camera

 8                                           Meeting audio capture
                                             → Deepgram → orchestrator
                                             → Gemini → ElevenLabs
                                             → HeyGen lip sync + mic

 9      ┌──────────────────────── SYNC: test meeting mode end-to-end ────────┐
        │ Join a real Google Meet with the avatar                            │
        │ Say the user's name, verify avatar responds                        │
        │ Check dashboard shows meeting transcript                           │
        └───────────────────────────────────────────────────────────────────-┘

 10     ┌──────────────────────── TOGETHER: rehearse demo ───────────────────┐
        │ Run through the full demo script (see 10-hackathon-plan.md)        │
        │ Phone call → Meeting avatar → Unified view                         │
        │ Time it. Fix anything that breaks. Rehearse again.                 │
        └───────────────────────────────────────────────────────────────────-┘
```

---

## How Person A Works Without the Backend

Person A doesn't need Person B's server running to build the dashboard. Use a **mock Socket.IO server** during development:

```typescript
// dashboard/src/lib/mock-server.ts (dev only)
import { Server } from 'socket.io';

const io = new Server(3001, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  // Simulate a phone call after 2 seconds
  setTimeout(() => {
    socket.emit('call:start', { id: '1', callerNumber: '+1234567890' });
  }, 2000);

  // Simulate transcript messages
  setTimeout(() => {
    socket.emit('call:transcript', { role: 'caller', content: 'Hey where are we on the capstone?' });
  }, 4000);

  setTimeout(() => {
    socket.emit('call:transcript', { role: 'agent', content: 'Yeah let me check on that real quick...' });
  }, 6000);

  // Handle meeting join
  socket.on('meeting:join_now', ({ url }) => {
    socket.emit('meeting:joining', { id: '2', meetingUrl: url });
    setTimeout(() => socket.emit('meeting:active', { id: '2' }), 3000);
    setTimeout(() => {
      socket.emit('meeting:transcript', { role: 'participant', content: 'Lucas, what did you work on?', speaker: 'Jake' });
    }, 5000);
  });
});
```

Run this with `npx tsx mock-server.ts` and the entire dashboard can be built and tested without any real backend, Twilio, or API keys.

---

## How Person B Tests Without the Dashboard

Person B doesn't need the dashboard to verify the pipeline works. Test with:

1. **Phone mode:** Just call the Twilio number from your phone. Listen for the AI response. Check server console logs for transcript flow.
2. **Meeting mode:** Join a Google Meet yourself on another device and watch if the avatar appears + responds.
3. **Socket.IO events:** Log all emitted events to console. When Person A is ready, the real dashboard just connects and it works.

---

## Dependency Map

```
Person A needs from Person B:         Person B needs from Person A:
─────────────────────────────         ─────────────────────────────
Nothing until hour 5.                 Nothing ever.
Uses mock server until then.          Tests via phone/console.

After hour 5: real server URL         After hour 5: bug reports,
to connect dashboard to.              help with prompts/testing.
```

**The two codebases are fully independent until the hour 5 sync point.** That's the whole point of the Socket.IO contract — agree on event shapes once, then work in parallel.