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

export type ToolExecutorFn = (name: string, args: Record<string, string>) => Promise<string>;

export type RunStreamingGeminiReplyOpts = {
  systemPrompt: string;
  /** Return true to stop speaking and exit (e.g. barge-in / new utterance). */
  shouldAbort: () => boolean;
  speakSentence: (text: string) => Promise<void>;
  /** Optional: called when a tool is invoked (for UI display) */
  onToolCall?: (toolName: string, toolArgs: string) => void;
  /** Optional: custom tool executor (e.g. with approval gate). Defaults to browserAgent.execute. */
  toolExecutor?: ToolExecutorFn;
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
  let fillerPlayed = false;

  const { shouldAbort, speakSentence, onToolCall, toolExecutor, systemPrompt, errorFallback, logLabel } = opts;
  const executor = toolExecutor ?? browserAgent.execute.bind(browserAgent);

  try {
    for await (const chunk of generateResponse(
      history,
      systemPrompt,
      executor
    )) {
      if (shouldAbort()) {
        return;
      }

      if (chunk.startsWith("__TOOL_CALL__")) {
        // Parse tool info: __TOOL_CALL__:toolName:{"arg":"val"}
        const colonIdx = chunk.indexOf(":", 14);
        if (colonIdx > 0) {
          const toolName = chunk.slice(14, colonIdx);
          const toolArgs = chunk.slice(colonIdx + 1);
          onToolCall?.(toolName, toolArgs);
        }

        if (sentenceBuffer.trim()) {
          await speakSentence(sentenceBuffer.trim());
          sentenceBuffer = "";
          if (shouldAbort()) {
            return;
          }
        }

        // Play filler on first tool round only
        if (!fillerPlayed) {
          fillerPlayed = true;
          await speakSentence("Yeah, give me one sec.");
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
