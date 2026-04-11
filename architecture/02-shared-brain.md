# Shared Brain Layer

Both phone and meeting modes implement the same `Session` interface:

```typescript
interface Session {
  id: string;
  type: 'phone' | 'meeting';
  sendAudio(pcmChunks: Buffer[]): void;
  addMessage(msg: Message): void;
  onBargeIn(): void;
  getConversationHistory(): Message[];
  getSystemPrompt(): string;
}
```

**Phone mode** implements `sendAudio` by converting PCM → mu-law 8kHz → Twilio WebSocket.
**Meeting mode** implements `sendAudio` by sending audio to both HeyGen (lip sync) and the meeting mic.

## Orchestrator Flow

```typescript
class BrainOrchestrator {
  async handleTranscript(session: Session, transcript: string, speaker?: string) {
    session.addMessage({ role: 'participant', content: transcript, speaker });

    if (!this.shouldRespond(session, transcript)) return;

    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-pro',
      contents: session.getConversationHistory(),
      config: {
        systemInstruction: session.getSystemPrompt(),
        tools: [{ functionDeclarations: this.getTools() }]
      }
    });

    // Handle streaming: text → TTS, function calls → browser agent
    for await (const chunk of stream) {
      if (chunk.functionCalls) {
        // Gemini wants to use a tool → send to browser agent
        for (const call of chunk.functionCalls) {
          const result = await browserAgent.execute(call.name, call.args);
          // Feed result back to Gemini and continue generating
        }
      } else {
        // Stream text → sentence chunking → TTS
        for (const sentence of sentenceChunker(chunk.text)) {
          const audio = await elevenlabs.synthesize(sentence);
          session.sendAudio(audio);
        }
      }
    }
  }

  // Phone: always respond. Meeting: only when name is mentioned.
  shouldRespond(session: Session, transcript: string): boolean {
    if (session.type === 'phone') return true;
    return transcript.toLowerCase().includes(USER_NAME.toLowerCase());
  }
}
```

## Tool Definitions for Gemini

```typescript
const tools = [
  {
    name: 'browse_url',
    description: 'Open a URL and extract information from the page',
    parameters: { type: 'object', properties: {
      url: { type: 'string', description: 'URL to open' },
      query: { type: 'string', description: 'What information to extract' }
    }, required: ['url', 'query'] }
  },
  {
    name: 'search_google',
    description: 'Search Google for information',
    parameters: { type: 'object', properties: {
      query: { type: 'string' }
    }, required: ['query'] }
  },
  {
    name: 'check_github',
    description: 'Check a GitHub repo for PRs, issues, commits, or conflicts',
    parameters: { type: 'object', properties: {
      repo: { type: 'string' },
      action: { type: 'string', description: 'What to check: prs, issues, commits, conflicts' }
    }, required: ['repo', 'action'] }
  }
];
```

Gemini decides when to call tools based on the conversation. While the browser agent works, the filler phrase ("let me check on that") plays to fill the silence.

## Sentence Chunking

Split Gemini's streaming output on `. ? !` boundaries and send each sentence to ElevenLabs TTS immediately — don't wait for the full response. This is critical for latency.
