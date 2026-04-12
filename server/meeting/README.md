# Google Meet integration (server)

## Env

Set `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`, `DEEPGRAM_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_*` in the repo root `.env`.

## Browser profile

Meet uses a **separate** browser profile at repo root `.browser-profile-meet` (not the browser-agent profile).

### "You can't join this video call"

This is usually **Meet blocking automation or guests**, not our join selectors.

1. **Use real Chrome** — In `.env` set `MEET_USE_CHROME_CHANNEL=true` and restart the server. Playwright will launch **Google Chrome** (must be installed) instead of bundled Chromium.
2. **Sign in** — Open a normal tab in that profile, go to `https://accounts.google.com`, and log in with an account **allowed in the meeting** (workspace meetings often disallow unsigned-in or external guests).
3. **Turn off fake media** — Try `MEET_USE_FAKE_MEDIA=0` so Chrome does not use `--use-fake-ui-for-media-stream` (you may get real mic/camera prompts once).
4. **Meeting policy** — Organizers can require “signed-in users” or same domain; guest links will always fail with that screen.

The server also strips Playwright’s `--enable-automation` flag, sets a normal Chrome user agent, and hides `navigator.webdriver` where possible — but **Chrome + login** is the most reliable fix.

## Headless / Linux demo

Google Meet expects a real display. For servers without a display, use **Xvfb** (see `architecture/10-hackathon-plan.md`).

## Fallbacks

If `getUserMedia` injection fails on a Meet update, use an OS-level virtual camera (e.g. OBS) as described in the hackathon plan.

## LiveKit script

`heygen-avatar.ts` loads `livekit-client` UMD from the repo `node_modules`. Run `npm install` from the repo root (or `server/`) so `node_modules/livekit-client/dist/livekit-client.umd.js` exists.
