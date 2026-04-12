import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

export interface Message {
  role: "user" | "model";
  parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>;
}

export type ToolExecutor = (
  name: string,
  args: Record<string, string>
) => Promise<string>;

const toolDeclarations = [
  {
    name: "browse_url",
    description: "Open a URL in the browser and read the page content. Use this to navigate to any website.",
    parameters: {
      type: "object" as const,
      properties: {
        url: { type: "string" as const, description: "The full URL to open" },
      },
      required: ["url"],
    },
  },
  {
    name: "click",
    description: "Click an element on the current page. Use text to find a button/link by its visible text, or selector for CSS selectors.",
    parameters: {
      type: "object" as const,
      properties: {
        text: { type: "string" as const, description: "Visible text of the element to click (e.g. 'Edit this file', 'Sign in', 'Submit')" },
        selector: { type: "string" as const, description: "CSS selector of the element to click (use only if text doesn't work)" },
      },
    },
  },
  {
    name: "type",
    description: "Type text into an input field or text area on the current page. Use selector to target a specific field, or omit to type into the currently focused element.",
    parameters: {
      type: "object" as const,
      properties: {
        text: { type: "string" as const, description: "The text to type" },
        selector: { type: "string" as const, description: "CSS selector of the input/textarea to type into (optional)" },
      },
      required: ["text"],
    },
  },
  {
    name: "read_page",
    description: "Read the current page content without navigating. Use this to check the current state of the page after clicking or typing.",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_files",
    description: "Search for files across the computer (Desktop, Documents, Downloads, and home folder). Use this whenever the caller mentions a document, file, report, spreadsheet, etc. Search with keywords from what the caller said — e.g. if they say 'the quarterly report', search for 'quarterly' or 'report'.",
    parameters: {
      type: "object" as const,
      properties: {
        directory: { type: "string" as const, description: "Specific directory to search (optional, searches common folders by default)" },
        search: { type: "string" as const, description: "Keywords to search for in filename/path (partial match, e.g. 'report', 'budget', 'project')" },
      },
    },
  },
  {
    name: "open_file",
    description: "Open a file on the computer with its default app (Word, Preview, etc.) and read its contents. Use this for .docx, .txt, .md, .csv files.",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "Full file path to open" },
      },
      required: ["path"],
    },
  },
  {
    name: "check_calendar",
    description: "Open the Calendar app and read scheduled events. Use this when the caller asks about meetings, schedule, availability, what's coming up, or anything time/date related.",
    parameters: {
      type: "object" as const,
      properties: {
        date: { type: "string" as const, description: "Date to check (e.g. 'today', 'April 15, 2026'). Defaults to today." },
      },
    },
  },
  {
    name: "create_event",
    description: "Create a new event in the Apple Calendar app. Use this when the caller wants to schedule a meeting, set a reminder, or book time. Accepts day names (Friday, Monday) or full dates.",
    parameters: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const, description: "Event title (e.g. 'Meeting with Jake', 'Code review')" },
        date: { type: "string" as const, description: "Day name (e.g. 'Friday', 'Monday') or full date (e.g. 'April 15, 2026')" },
        startTime: { type: "string" as const, description: "Start time in 24h format (e.g. '14:00', '19:00'). Defaults to 09:00." },
        endTime: { type: "string" as const, description: "End time in 24h format (e.g. '15:00'). Defaults to 1 hour after start." },
      },
      required: ["title", "date"],
    },
  },
];

const MAX_TOOL_ROUNDS = 10;

export async function* generateResponse(
  history: Message[],
  systemPrompt: string,
  toolExecutor?: ToolExecutor
): AsyncGenerator<string> {
  let currentHistory = [...history];
  let round = 0;

  try {
    while (round < MAX_TOOL_ROUNDS) {
      round++;

      const response = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: currentHistory,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: toolDeclarations as any }],
          maxOutputTokens: 200,
        },
      });

      const functionCalls: Array<{ name: string; args: any }> = [];
      let roundText = "";

      for await (const chunk of response) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          for (const call of chunk.functionCalls) {
            console.log(`[gemini] Tool call (round ${round}): ${call.name}`, call.args);
            functionCalls.push({ name: call.name!, args: call.args });
          }
          continue;
        }

        if (chunk.text) {
          roundText += chunk.text;
        }
      }

      // No tool calls — this is the final round, yield the text
      if (functionCalls.length === 0 || !toolExecutor) {
        if (roundText) yield roundText;
        break;
      }

      // Intermediate round — discard Gemini's filler text, play our own filler instead
      if (roundText) console.log(`[gemini] (suppressed intermediate text): ${roundText}`);
      // Yield tool info so orchestrator can emit to dashboard
      for (const call of functionCalls) {
        yield `__TOOL_CALL__:${call.name}:${JSON.stringify(call.args)}`;
      }

      // Execute tools and build history entries
      const functionCallParts: any[] = [];
      const toolResultParts: any[] = [];

      for (const call of functionCalls) {
        console.log(`[gemini] Executing: ${call.name} (round ${round})`);
        const result = await toolExecutor(call.name, call.args);
        console.log(`[gemini] Result (${call.name}): ${result.slice(0, 150)}...`);

        functionCallParts.push({ functionCall: { name: call.name, args: call.args } });
        toolResultParts.push({
          functionResponse: { name: call.name, response: { result } },
        });
      }

      // Extend history for next round
      currentHistory = [
        ...currentHistory,
        { role: "model", parts: functionCallParts },
        { role: "user", parts: toolResultParts },
      ];
    }

    if (round >= MAX_TOOL_ROUNDS) {
      console.warn("[gemini] Hit max tool rounds");
    }
  } catch (err) {
    console.error("[gemini] Error:", err);
    yield "Sorry, I'm having trouble with that right now.";
  }
}
