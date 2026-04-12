import { generateResponse, type Message } from "./gemini.js";
import { browserAgent } from "../browser-agent/agent.js";

const SENTENCE_END = /(?<=[.?!])\s+/;

export function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
  const parts = buffer.split(SENTENCE_END);
  if (parts.length <= 1) {
    return { sentences: [], remainder: buffer };
  }
  const remainder = parts.pop()!;
  return { sentences: parts, remainder };
}

export type RunStreamingGeminiReplyOpts = {
  systemPrompt: string;
  /** Return true to stop speaking and exit (e.g. barge-in / new utterance). */
  shouldAbort: () => boolean;
  speakSentence: (text: string) => Promise<void>;
  errorFallback: string;
  logLabel: string;
};

/**
 * Shared Gemini streaming loop: tool rounds, sentence chunking, TTS via speakSentence.
 * Appends a single model message to `history` when the reply completes (including empty abort before any model text).
 */
export async function runStreamingGeminiReply(
  history: Message[],
  opts: RunStreamingGeminiReplyOpts
): Promise<void> {
  let sentenceBuffer = "";
  let allText = "";

  const { shouldAbort, speakSentence, systemPrompt, errorFallback, logLabel } = opts;

  try {
    for await (const chunk of generateResponse(
      history,
      systemPrompt,
      browserAgent.execute.bind(browserAgent)
    )) {
      if (shouldAbort()) {
        return;
      }

      if (chunk === "__TOOL_CALL__") {
        if (sentenceBuffer.trim()) {
          await speakSentence(sentenceBuffer.trim());
          sentenceBuffer = "";
          if (shouldAbort()) {
            return;
          }
        }
        continue;
      }

      allText += chunk;
      sentenceBuffer += chunk;

      const { sentences, remainder } = extractSentences(sentenceBuffer);
      sentenceBuffer = remainder;

      for (const sentence of sentences) {
        if (shouldAbort()) {
          return;
        }
        await speakSentence(sentence);
      }
    }
  } catch (err) {
    console.error(`[${logLabel}] Error:`, err);
    if (!shouldAbort()) {
      await speakSentence(errorFallback);
    }
    return;
  }

  if (sentenceBuffer.trim() && !shouldAbort()) {
    await speakSentence(sentenceBuffer.trim());
  }

  if (allText.trim()) {
    history.push({ role: "model", parts: [{ text: allText }] });
  }
}
