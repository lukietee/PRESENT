# Phone Mode: Call Flow

## What happens when someone calls

```
Step 1: RING
────────────────────────────────────────────────────────
Caller dials your Twilio number
  → Twilio sends webhook to your server
  → Server responds with TwiML: <Connect><Stream>
  → Twilio opens WebSocket Media Stream
  → Dashboard receives "call:start" via Socket.IO

Step 2: GREETING
────────────────────────────────────────────────────────
Server sends a hardcoded greeting through ElevenLabs TTS:
  "Hey what's up"
  → Audio sent back through Twilio to caller

Step 3: CONVERSATION LOOP (repeats)
────────────────────────────────────────────────────────
Caller speaks
  → Twilio streams mu-law audio via WebSocket
  → Server pipes audio → Deepgram streaming STT
  → Deepgram returns transcript
  → Transcript sent to Dashboard via Socket.IO
  → BrainOrchestrator.handleTranscript()
  → Gemini responds (streaming)
  → Sentence chunks → ElevenLabs TTS
  → TTS audio → mu-law → Twilio → Caller

IF Gemini calls a tool:
  → Filler phrase plays: "Let me check on that real quick..."
  → Browser agent opens page in separate Playwright instance
  → Extracts info → returns result to Gemini
  → Gemini incorporates result into response

Step 4: HANG UP
────────────────────────────────────────────────────────
Either party ends call
  → Dashboard receives "call:end" via Socket.IO
```

## Latency Budget (target: <1.5s)

```
Caller speaks → [audio travels] .............. ~100ms
Deepgram STT (streaming) ..................... ~300ms
Gemini API (time to first token) ............. ~500ms
Sentence buffer + ElevenLabs TTS ............. ~400ms
Audio back to caller ......................... ~100ms
                                         ─────────────
Total ........................................ ~1.4s
```

## Audio Format Conversion

```
Twilio → Server:     mu-law 8kHz mono (base64)
Server → Deepgram:   mu-law 8kHz mono (native)
Server → Gemini:     text (from transcript)
Gemini → Server:     text
Server → ElevenLabs: text → PCM 24kHz audio
ElevenLabs → Twilio: PCM 24kHz → mu-law 8kHz base64
```

## ElevenLabs Voice Clone Setup

```
1. Record 1-5 minutes of natural speech
2. Upload via ElevenLabs "Instant Voice Cloning" API:
   POST /v1/voices/add
   - name: "my-clone"
   - files: [audio_samples]
3. Receive voice_id → store in .env
4. Use voice_id in all TTS calls
```
