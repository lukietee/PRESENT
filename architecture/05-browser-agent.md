# Browser Agent

A **separate** Playwright browser instance (headless) that Gemini uses to look things up in real time. This runs independently from the meeting browser tab.

## How It Works

```
Gemini calls a tool (e.g., check_github)
  → Browser agent receives the call
  → Playwright opens the relevant page
  → Extracts text / takes screenshot
  → Parses result with Gemini multimodal (if needed)
  → Returns structured text to the orchestrator
  → Gemini uses the result in its response
```

Meanwhile, a filler phrase plays: "Hold on let me pull that up..." so the caller/meeting doesn't hear dead silence.

## Implementation (simplified for MVP)

```typescript
class BrowserAgent {
  private browser: Browser;
  private context: BrowserContext;

  async init() {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext();
  }

  async execute(toolName: string, args: Record<string, any>): Promise<string> {
    const page = await this.context.newPage();
    try {
      switch (toolName) {
        case 'browse_url':
          return await this.browseUrl(page, args.url, args.query);
        case 'search_google':
          return await this.searchGoogle(page, args.query);
        case 'check_github':
          return await this.checkGithub(page, args.repo, args.action);
        default:
          return 'Unknown tool';
      }
    } finally {
      await page.close();
    }
  }

  private async browseUrl(page: Page, url: string, query: string): Promise<string> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const text = await page.innerText('body');
    // Truncate and return relevant text (or use Gemini to extract)
    return text.slice(0, 2000);
  }

  private async searchGoogle(page: Page, query: string): Promise<string> {
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    const results = await page.$$eval('.g', els =>
      els.slice(0, 3).map(el => el.textContent).join('\n')
    );
    return results || 'No results found';
  }

  private async checkGithub(page: Page, repo: string, action: string): Promise<string> {
    const urls: Record<string, string> = {
      prs: `https://github.com/${repo}/pulls`,
      issues: `https://github.com/${repo}/issues`,
      commits: `https://github.com/${repo}/commits`,
    };
    await page.goto(urls[action] ?? urls.commits, { waitUntil: 'domcontentloaded' });
    const text = await page.innerText('body');
    return text.slice(0, 2000);
  }
}
```

## Key Design Decisions (MVP)

- **Separate browser context** from the meeting tab — the agent browsing Google Drive should never interfere with the meeting
- **All actions auto-approved** — no approval UI for the hackathon. Every tool call just runs.
- **Headless mode** — no need to see the agent browser, it runs in the background
- **Text extraction over screenshots** — faster and simpler. Use `page.innerText()` instead of screenshot + vision model. Fall back to screenshots only if text extraction fails.
- **Pre-authenticated sessions** — for the demo, log into Google/GitHub in the browser context beforehand so the agent can access your Drive, repos, etc.
