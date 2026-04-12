import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import { exec, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = path.resolve(__dirname, "../../.browser-profile");

class BrowserAgent {
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      args: ["--window-position=960,0", "--window-size=960,1080"],
      viewport: { width: 960, height: 1080 },
    });
    console.log("[browser-agent] Chromium launched (headed mode, persistent profile)");
  }

  async execute(toolName: string, args: Record<string, string>): Promise<string> {
    console.log(`[browser-agent] ${toolName}`, args);

    try {
      switch (toolName) {
        case "browse_url":
          if (!this.context) return "Error: browser not initialized";
          return await this.browseUrl(args.url);
        case "click":
          return await this.click(args.text, args.selector);
        case "type":
          return await this.typeText(args.text, args.selector);
        case "read_page":
          return await this.readPage();
        case "list_files":
          return await this.listFiles(args.directory, args.search);
        case "open_file":
          return await this.openFile(args.path);
        case "check_calendar":
          return await this.checkCalendar(args.date);
        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (err: any) {
      console.error(`[browser-agent] Error in ${toolName}:`, err.message);
      return `Error: ${err.message}`;
    }
  }

  private async browseUrl(url: string): Promise<string> {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }
    this.page = await this.context!.newPage();
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await this.page.waitForTimeout(1000);
    const text = await this.page.innerText("body");
    console.log(`[browser-agent] Loaded ${url} (${text.length} chars)`);
    return text.slice(0, 3000);
  }

  private async click(text?: string, selector?: string): Promise<string> {
    if (!this.page) return "Error: no page open. Use browse_url first.";
    if (text) {
      await this.page.getByText(text, { exact: false }).first().click({ timeout: 5000 });
    } else if (selector) {
      await this.page.click(selector, { timeout: 5000 });
    } else {
      return "Error: provide either text or selector to click";
    }
    await this.page.waitForTimeout(1500);
    const content = await this.page.innerText("body");
    console.log(`[browser-agent] Clicked, page now: ${content.length} chars`);
    return content.slice(0, 3000);
  }

  private async typeText(text: string, selector?: string): Promise<string> {
    if (!this.page) return "Error: no page open. Use browse_url first.";
    if (selector) {
      await this.page.fill(selector, text, { timeout: 5000 });
    } else {
      await this.page.keyboard.type(text, { delay: 20 });
    }
    console.log(`[browser-agent] Typed ${text.length} chars`);
    return `Typed: "${text.slice(0, 100)}"`;
  }

  private async readPage(): Promise<string> {
    if (!this.page) return "Error: no page open. Use browse_url first.";
    const text = await this.page.innerText("body");
    return text.slice(0, 3000);
  }

  private async listFiles(directory?: string, search?: string): Promise<string> {
    const dir = directory || "/Users/lukiet";
    const searchDirs = [
      path.join(dir, "Desktop"),
      path.join(dir, "Documents"),
      path.join(dir, "Downloads"),
    ];

    const results: string[] = [];

    for (const searchDir of searchDirs) {
      try {
        const entries = await fs.readdir(searchDir, { withFileTypes: true, recursive: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const fullPath = path.join(entry.parentPath || searchDir, entry.name);
          if (search && !entry.name.toLowerCase().includes(search.toLowerCase())) continue;
          results.push(fullPath);
          if (results.length >= 20) break;
        }
      } catch {}
      if (results.length >= 20) break;
    }

    console.log(`[browser-agent] Found ${results.length} files`);
    return results.length > 0
      ? `Files found:\n${results.join("\n")}`
      : "No files found matching that search.";
  }

  private async openFile(filePath: string): Promise<string> {
    if (!filePath) return "Error: no file path provided";

    // Open the file visually with default app (Word, Preview, etc.)
    exec(`open "${filePath}"`);
    console.log(`[browser-agent] Opened: ${filePath}`);

    // Read the content
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".docx") {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return `Contents of ${path.basename(filePath)}:\n${result.value.slice(0, 3000)}`;
    }

    if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
      const content = await fs.readFile(filePath, "utf-8");
      return `Contents of ${path.basename(filePath)}:\n${content.slice(0, 3000)}`;
    }

    if ([".pdf"].includes(ext)) {
      return `Opened ${path.basename(filePath)} — PDF reading not supported, but it's now visible on screen.`;
    }

    return `Opened ${path.basename(filePath)} on screen.`;
  }

  private async checkCalendar(date?: string): Promise<string> {
    // Open Calendar app visually
    exec("open -a Calendar");

    // Use AppleScript to read events
    const targetDate = date || "today";
    const script = `
      set targetDate to current date
      if "${targetDate}" is not "today" then
        set targetDate to date "${targetDate}"
      end if
      set startOfDay to targetDate
      set time of startOfDay to 0
      set endOfDay to targetDate
      set time of endOfDay to 86399
      set output to ""
      tell application "Calendar"
        repeat with cal in calendars
          set eventList to (every event of cal whose start date ≥ startOfDay and start date ≤ endOfDay)
          repeat with e in eventList
            set eventStart to start date of e
            set eventEnd to end date of e
            set hours to (time of eventStart) div 3600
            set mins to ((time of eventStart) mod 3600) div 60
            set timeStr to (hours as text) & ":" & text -2 thru -1 of ("0" & mins as text)
            set output to output & "- " & timeStr & " " & summary of e & linefeed
          end repeat
        end repeat
      end tell
      if output is "" then
        return "No events scheduled for " & (targetDate as text)
      else
        return "Events for " & (targetDate as text) & ":" & linefeed & output
      end if
    `;

    try {
      const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
        timeout: 10000,
        encoding: "utf-8",
      });
      console.log(`[browser-agent] Calendar: ${result.trim()}`);
      return result.trim();
    } catch (err: any) {
      console.error("[browser-agent] Calendar error:", err.message);
      return "Couldn't read calendar — make sure Calendar app has permissions.";
    }
  }

  async shutdown(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
    console.log("[browser-agent] Chromium closed");
  }
}

export const browserAgent = new BrowserAgent();
