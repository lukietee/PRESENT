import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    if (!this.context) {
      return "Error: browser not initialized";
    }

    console.log(`[browser-agent] ${toolName}`, args);

    try {
      switch (toolName) {
        case "browse_url":
          return await this.browseUrl(args.url);
        case "click":
          return await this.click(args.text, args.selector);
        case "type":
          return await this.typeText(args.text, args.selector);
        case "read_page":
          return await this.readPage();
        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (err: any) {
      console.error(`[browser-agent] Error in ${toolName}:`, err.message);
      return `Error: ${err.message}`;
    }
  }

  private async browseUrl(url: string): Promise<string> {
    // Close previous page, open new one
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

  async shutdown(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
    console.log("[browser-agent] Chromium closed");
  }
}

export const browserAgent = new BrowserAgent();
