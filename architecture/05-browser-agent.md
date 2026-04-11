# Browser Agent

A **separate** Playwright browser instance (**headed / visible**) that Gemini uses to look things up in real time. This runs independently from the meeting browser tab. Judges can see the browser navigating in real time on the laptop screen.

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
    this.browser = await chromium.launch({
      headless: false,  // Visible — judges watch the agent browse in real time
      args: ['--window-size=800,600', '--window-position=960,0']  // Right half of screen
    });
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
- **Headed mode (visible)** — the browser agent window is shown on the right half of the laptop screen so judges can watch it navigate in real time. This is a huge demo flex.
- **Text extraction over screenshots** — faster and simpler. Use `page.innerText()` instead of screenshot + vision model. Fall back to screenshots only if text extraction fails.
- **Pre-authenticated sessions** — for the demo, log into Google/GitHub in the browser context beforehand so the agent can access your Drive, repos, etc.

## Demo Setup — Laptop Screen Layout

```
┌───────────────────────┬───────────────────────┐
│                       │                       │
│     Google Meet       │    Browser Agent      │
│   (avatar visible     │   (Playwright —       │
│    to participants)   │    judges watch it    │
│                       │    open GitHub,       │
│                       │    Google Drive, etc) │
│                       │                       │
└───────────────────────┴───────────────────────┘
         Left half              Right half

Phone (in hand): Dashboard with live transcript
Friend's phone:  Calls your Twilio number / joins Google Meet
```
