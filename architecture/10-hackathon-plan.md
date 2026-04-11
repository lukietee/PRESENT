# Hackathon Plan

## MVP Checklist

| # | Feature | Owner | Status |
|---|---------|-------|--------|
| 1 | Phone voice pipeline (Twilio → Deepgram → Gemini → ElevenLabs → caller) | B | |
| 2 | ElevenLabs voice clone on phone | B | |
| 3 | Browser agent (Playwright) does real lookups for Gemini tool calls | B | |
| 4 | Dashboard shows live transcript for active call | A | |
| 5 | HeyGen LiveAvatar lip-synced to ElevenLabs output | B | |
| 6 | Join Google Meet via Playwright + inject avatar as camera | B | |
| 7 | Meeting audio → Deepgram → Gemini responds when name spoken | B | |
| 8 | Dashboard shows meeting transcript + "Join Now" input | A | |

**If extra time → spend it on:**
- Making the dashboard look polished (dark mode, animations, clean typography)
- Tuning the voice clone to sound more natural
- Tuning the system prompt so Gemini responds more naturally
- Rehearsing the demo

## Key Risks

| Risk | Mitigation |
|------|------------|
| Voice latency too high | Stream at every stage, filler phrases, sentence chunking |
| ElevenLabs doesn't sound like user | High quality samples, phone audio masks imperfections |
| getUserMedia override fails | Fallback: OBS virtual camera at OS level |
| Google Meet blocks Playwright | Headed mode with Xvfb, stealth plugin, realistic user-agent |
| HeyGen session timeout (5min idle) | `keep_alive` every 30s |
| HeyGen avatar video latency | Pre-warm session before meeting join |
| Browser agent too slow | Filler phrase while loading, extract text not screenshots |

## Demo Script (3-4 minutes)

### Act 1: The Phone Call (1 min)

1. Show dashboard — empty, waiting
2. Call the Twilio number from another phone
3. "Hey, where are we on the capstone?"
4. AI responds naturally in your cloned voice
5. Browser agent checks GitHub: "Let me check... Auth middleware is done, dashboard is 80% complete"
6. End call — dashboard shows ended

> "That's the phone. But what about the 9am standup I slept through?"

### Act 2: The Meeting Avatar (2 min) — The Wow Factor

1. Dashboard: paste a Google Meet URL → "Join Now"
2. Switch to the actual Google Meet (on another screen):
   - Avatar appears on camera — photorealistic, your face
3. Teammate: "Lucas, what did you work on yesterday?"
4. Avatar responds with synced lip movement:
   "Yeah so yesterday I pushed the auth middleware and fixed that CORS bug. Today I'm gonna finish the dashboard. No blockers."
5. Dashboard shows live transcript updating in real-time
6. Avatar stays quiet when not addressed

> "I was asleep the whole time. Nobody knew the difference."

### Act 3: Unified View (30 sec)

1. Show both a phone call and meeting active on dashboard simultaneously
2. "Same brain, same voice, two completely different modes."
3. "PhoneClone. Never miss a call — or a meeting — again."
