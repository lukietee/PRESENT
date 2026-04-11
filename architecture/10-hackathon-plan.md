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

## Demo Setup

```
You have:
  - Your phone (dashboard open in browser)
  - Your laptop (Google Meet left half, Browser Agent right half)
  - Your friend (their phone + joins Google Meet from their laptop)
```

## Demo Script (3-4 minutes)

### Act 1: The Phone Call (1 min)

1. Hold up phone — dashboard is empty, waiting
2. Friend calls your Twilio number from their phone
3. Friend: "Hey, where are we on the capstone?"
4. AI responds naturally in your cloned voice
5. Laptop screen: judges watch Playwright open GitHub in real time
6. AI: "Let me check... Auth middleware is done, dashboard is 80% complete"
7. Phone: dashboard shows the live transcript updating as they talk
8. End call

> "That's the phone. But what about the 9am standup I slept through?"

### Act 2: The Meeting Avatar (2 min) — The Wow Factor

1. On phone dashboard: paste a Google Meet URL → "Join Now"
2. Point to laptop — left half shows Google Meet:
   - Avatar appears on camera — photorealistic, your face
   - Friend is already in the Meet on their laptop
3. Friend: "Lucas, what did you work on yesterday?"
4. Avatar responds with synced lip movement:
   "Yeah so yesterday I pushed the auth middleware and fixed that CORS bug. Today I'm gonna finish the dashboard. No blockers."
5. Phone: dashboard shows meeting transcript updating live
6. Friend: "Can you check if my branch has conflicts?"
7. Laptop right half: judges watch Playwright open GitHub repo in real time
8. Avatar: "One sec let me check... yeah you've got two conflicts in routes/auth.js"
9. Avatar stays quiet when not addressed

> "I was asleep the whole time. Nobody knew the difference."

### Act 3: Closing (30 sec)

1. "Same brain, same voice clone, same browser agent — two completely different modes."
2. "PhoneClone. Never miss a call — or a meeting — again."
