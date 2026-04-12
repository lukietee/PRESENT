import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

export interface Message {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

const toolDeclarations = [
  {
    name: "browse_url",
    description: "Open a URL and extract information from the page",
    parameters: {
      type: "object" as const,
      properties: {
        url: { type: "string" as const, description: "URL to open" },
        query: { type: "string" as const, description: "What information to extract" },
      },
      required: ["url", "query"],
    },
  },
  {
    name: "check_github",
    description: "Check a GitHub repo for PRs, issues, commits, or conflicts",
    parameters: {
      type: "object" as const,
      properties: {
        repo: { type: "string" as const, description: "GitHub repo (owner/name)" },
        action: { type: "string" as const, description: "What to check: prs, issues, commits, conflicts" },
      },
      required: ["repo", "action"],
    },
  },
  {
    name: "search_google",
    description: "Search Google for information",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Search query" },
      },
      required: ["query"],
    },
  },
];

export async function* generateResponse(
  history: Message[],
  systemPrompt: string
): AsyncGenerator<string> {
  try {
    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: history,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    for await (const chunk of response) {
      // Check for function calls
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        for (const call of chunk.functionCalls) {
          console.log(`[gemini] Tool call requested: ${call.name}`, call.args);
        }
        continue;
      }

      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (err) {
    console.error("[gemini] Error:", err);
    yield "Sorry, I didn't catch that. Can you say that again?";
  }
}
