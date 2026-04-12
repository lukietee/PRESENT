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
        case "create_event":
          return await this.createEvent(args.title, args.date, args.startTime, args.endTime);
        case "send_email":
          return await this.sendEmail(args.to, args.subject, args.body, args.attachmentPath);
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
    const home = "/Users/lukiet";
    const searchDirs = directory
      ? [directory]
      : [
          path.join(home, "Desktop"),
          path.join(home, "Documents"),
          path.join(home, "Downloads"),
        ];

    // Only find actual documents, not code files
    const docExts = [".docx", ".doc", ".pdf", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".csv", ".rtf", ".pages", ".numbers", ".key"];
    const results: string[] = [];
    const searchTerms = search?.toLowerCase().split(/\s+/) || [];

    for (const searchDir of searchDirs) {
      try {
        const entries = await fs.readdir(searchDir, { withFileTypes: true, recursive: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (entry.name.startsWith(".") || entry.name.startsWith("~$")) continue;
          const fullPath = path.join(entry.parentPath || searchDir, entry.name);
          if (fullPath.includes("node_modules") || fullPath.includes(".git")) continue;

          // Only document files
          const ext = path.extname(entry.name).toLowerCase();
          if (!docExts.includes(ext)) continue;

          if (searchTerms.length > 0) {
            const nameLower = entry.name.toLowerCase();
            const pathLower = fullPath.toLowerCase();
            const matches = searchTerms.some(term => nameLower.includes(term) || pathLower.includes(term));
            if (!matches) continue;
          }

          results.push(fullPath);
          if (results.length >= 10) break;
        }
      } catch {}
      if (results.length >= 10) break;
    }

    console.log(`[browser-agent] Found ${results.length} docs for search: ${search}`);
    return results.length > 0
      ? `Documents found:\n${results.join("\n")}\n\nCall open_file with the path to open and read the document.`
      : `No documents found matching "${search}". Try different keywords.`;
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
      return "No calendar events found for that date.";
    }
  }

  private parseRelativeDate(dateStr: string): Date {
    const now = new Date();
    const lower = dateStr.toLowerCase().trim();

    // Check for day names
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayIndex = days.indexOf(lower);
    if (dayIndex >= 0) {
      const today = now.getDay();
      let diff = dayIndex - today;
      if (diff <= 0) diff += 7; // Next occurrence
      const d = new Date(now);
      d.setDate(d.getDate() + diff);
      return d;
    }

    if (lower === "today") return now;
    if (lower === "tomorrow") {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d;
    }

    // Try native Date parsing for absolute dates
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;

    // Fallback: return tomorrow
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }

  private async createEvent(title: string, date: string, startTime?: string, endTime?: string): Promise<string> {
    const eventDate = this.parseRelativeDate(date);
    const startH = parseInt(startTime?.split(":")[0] || "9");
    const startM = parseInt(startTime?.split(":")[1] || "0");
    const endH = endTime ? parseInt(endTime.split(":")[0]) : startH + 1;
    const endM = endTime ? parseInt(endTime.split(":")[1] || "0") : startM;

    // Build start/end Date objects
    const start = new Date(eventDate);
    start.setHours(startH, startM, 0, 0);
    const end = new Date(eventDate);
    end.setHours(endH, endM, 0, 0);

    // Format as ICS timestamps: 20260418T140000
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");

    const safeTitle = title.replace(/[^a-zA-Z0-9 .,!?@#&()\-]/g, "");
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Present//PhoneClone//EN",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${safeTitle}`,
      `UID:${Date.now()}@present`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const tmpFile = `/tmp/present-event-${Date.now()}.ics`;
    try {
      await fs.writeFile(tmpFile, icsContent);
      exec(`open "${tmpFile}"`);

      const dateStr = start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const timeStr = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      console.log(`[browser-agent] Created event: ${safeTitle} on ${dateStr} at ${timeStr}`);
      return `Event created: ${safeTitle} on ${dateStr} at ${timeStr}`;
    } catch (err: any) {
      console.error("[browser-agent] Create event error:", err.message);
      return "Couldn't create the calendar event.";
    }
  }

  private async sendEmail(to: string, subject: string, body: string, attachmentPath?: string): Promise<string> {
    if (!to || !subject || !body) return "Error: need to, subject, and body for email";

    const safeTo = to.replace(/"/g, "");
    const safeSubject = subject.replace(/"/g, '\\"');
    const safeBody = body.replace(/"/g, '\\"').replace(/\n/g, "\\n");

    let attachmentLine = "";
    if (attachmentPath) {
      attachmentLine = `make new attachment at newMessage with properties {file:(POSIX file "${attachmentPath.replace(/"/g, "")}")}`;
    }

    // Try Outlook first, fall back to Mail.app
    const outlookScript = `
tell application "Microsoft Outlook"
  activate
  set newMessage to make new outgoing message with properties {subject:"${safeSubject}", content:"${safeBody}"}
  make new recipient at newMessage with properties {email address:{address:"${safeTo}"}}
  ${attachmentLine}
  send newMessage
end tell
return "Email sent to ${safeTo}"
`;

    const mailScript = `
tell application "Mail"
  activate
  set newMessage to make new outgoing message with properties {subject:"${safeSubject}", content:"${safeBody}", visible:true}
  tell newMessage
    make new to recipient at end of to recipients with properties {address:"${safeTo}"}
  end tell
  send newMessage
end tell
return "Email sent to ${safeTo}"
`;

    // Check if Outlook is installed
    const tmpFile = `/tmp/present-email-${Date.now()}.scpt`;
    try {
      const checkOutlook = execSync('mdfind "kMDItemCFBundleIdentifier == com.microsoft.Outlook"', { encoding: "utf-8" }).trim();
      const script = checkOutlook ? outlookScript : mailScript;
      const appName = checkOutlook ? "Outlook" : "Mail";

      await fs.writeFile(tmpFile, script);
      const result = execSync(`osascript ${tmpFile}`, { timeout: 15000, encoding: "utf-8" });
      console.log(`[browser-agent] ${result.trim()} via ${appName}`);
      return result.trim() + (attachmentPath ? ` with attachment` : "");
    } catch (err: any) {
      console.error("[browser-agent] Send email error:", err.message?.slice(0, 200));
      return "Couldn't send the email — might need mail app permissions.";
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
