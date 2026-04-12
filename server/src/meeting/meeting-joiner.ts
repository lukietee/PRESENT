import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Isolated from browser-agent — see architecture/05-browser-agent.md */
export const MEET_USER_DATA_DIR = path.resolve(
  __dirname,
  "../../../.browser-profile-meet"
);

/** Recent desktop Chrome UA — Meet often rejects HeadlessChrome / automation defaults. */
const DEFAULT_MEET_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Hide common automation signals Meet uses to show "You can't join this video call".
 */
function meetBrowserLaunchOptions(): Parameters<
  typeof chromium.launchPersistentContext
>[1] {
  const args = [
    "--autoplay-policy=no-user-gesture-required",
    // Reduces automation fingerprint (Playwright adds --enable-automation by default).
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--disable-dev-shm-usage",
  ];
  if (config.meeting.useFakeMediaStream) {
    args.push("--use-fake-ui-for-media-stream");
  }

  const opts: Parameters<typeof chromium.launchPersistentContext>[1] = {
    headless: false,
    args,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ["--enable-automation"],
    userAgent: config.meeting.userAgent || DEFAULT_MEET_USER_AGENT,
    permissions: ["camera", "microphone"],
  };

  if (config.meeting.useChromeChannel) {
    opts.channel = "chrome";
  }

  return opts;
}

/**
 * Check if the persistent profile has a Google sign-in cookie.
 * If not, open accounts.google.com and wait for the user to sign in manually (one-time setup).
 */
async function ensureGoogleSignIn(ctx: BrowserContext): Promise<void> {
  const cookies = await ctx.cookies("https://accounts.google.com");
  const hasSession = cookies.some(
    (c) => c.name === "SID" || c.name === "SSID" || c.name === "__Secure-1PSID"
  );
  if (hasSession) {
    console.log("[meeting-joiner] Google session found in profile — skipping sign-in");
    return;
  }

  console.log("[meeting-joiner] No Google session found — opening sign-in page (one-time setup)");
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("https://accounts.google.com/signin", { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Wait for user to complete sign-in (poll for session cookie, up to 5 minutes)
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const nowCookies = await ctx.cookies("https://accounts.google.com");
    const signedIn = nowCookies.some(
      (c) => c.name === "SID" || c.name === "SSID" || c.name === "__Secure-1PSID"
    );
    if (signedIn) {
      console.log("[meeting-joiner] Google sign-in complete!");
      await new Promise((r) => setTimeout(r, 2000));
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.warn("[meeting-joiner] Sign-in timed out after 5 minutes — proceeding anyway");
}

export async function launchMeetingBrowser(): Promise<BrowserContext> {
  const launchOpts = meetBrowserLaunchOptions();
  const ctx = await chromium.launchPersistentContext(
    MEET_USER_DATA_DIR,
    launchOpts
  );

  await ctx.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
        configurable: true,
      });
    } catch {
      /* ignore */
    }
    const win = window as unknown as { chrome?: { runtime?: unknown } };
    if (!win.chrome) {
      win.chrome = { runtime: {} };
    }
  });

  const engine = config.meeting.useChromeChannel ? "Chrome" : "Chromium";
  console.log(
    `[meeting-joiner] ${engine} launched (Meet profile: ${MEET_USER_DATA_DIR}, fakeMedia=${config.meeting.useFakeMediaStream})`
  );

  await ctx.grantPermissions(["camera", "microphone"], {
    origin: "https://meet.google.com",
  });

  await ensureGoogleSignIn(ctx);

  return ctx;
}

async function dismissOverlays(page: Page): Promise<void> {
  const dismissLabels = [
    /Accept all/i,
    /Got it/i,
    /Dismiss/i,
    /^OK$/i,
    /Continue/i,
    /I understand/i,
    /Close/i,
    /No thanks/i,
    /Use without/i,
    /Continue without microphone/i,
    /Continue without camera/i,
    /Use without an account/i,
    /Join without signing in/i,
    /Use Meet without an account/i,
  ];
  for (let pass = 0; pass < 4; pass++) {
    let hit = false;

    // Try role="button" first
    for (const label of dismissLabels) {
      const roleBtn = page.getByRole("button", { name: label }).first();
      if (await roleBtn.isVisible().catch(() => false)) {
        await roleBtn.click({ timeout: 3000 }).catch(() => {});
        hit = true;
        console.log(`[meeting-joiner] dismissed overlay (role button): ${label}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Also try text-based clicks — Google Meet uses custom elements
    for (const label of dismissLabels) {
      const textEl = page.getByText(label, { exact: false }).first();
      if (await textEl.isVisible().catch(() => false)) {
        await textEl.click({ timeout: 3000 }).catch(() => {});
        hit = true;
        console.log(`[meeting-joiner] dismissed overlay (text): ${label}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Try clicking any visible element that looks like a dismiss button
    const genericDismiss = [
      'button:has-text("Got it")',
      '[data-mdc-dialog-action="ok"]',
      '[data-mdc-dialog-action="accept"]',
      '.VfPpkd-LgbsSe:has-text("Got it")',
      // "Camera might be blocked" toast dismiss
      '[aria-label="Close"]',
      'button[aria-label="Dismiss"]',
    ];
    for (const sel of genericDismiss) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) {
        await el.click({ timeout: 3000 }).catch(() => {});
        hit = true;
        console.log(`[meeting-joiner] dismissed overlay (selector): ${sel}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!hit) break;
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * Meet often uses <div role="button">, not <button>. Try role + text, then loose text click.
 */
async function tryClickJoin(page: Page): Promise<boolean> {
  const roleLocators = [
    page.getByRole("button", { name: /ask to join/i }),
    page.getByRole("button", { name: /join now/i }),
    page.getByRole("button", { name: /join meeting/i }),
    page.getByRole("button", { name: /enter meeting/i }),
    page.getByRole("button", { name: /^join$/i }),
    page.getByRole("button", { name: /join\b/i }),
    page.locator('[role="button"]').filter({ hasText: /^Ask to join$/i }),
    page.locator('[role="button"]').filter({ hasText: /^Join now$/i }),
    page.locator('[role="button"]').filter({ hasText: /Ask to join/i }),
    page.locator('[role="button"]').filter({ hasText: /Join now/i }),
    page.locator('[role="button"]').filter({ hasText: /Join meeting/i }),
    page.locator('button').filter({ hasText: /Ask to join/i }),
    page.locator('button').filter({ hasText: /Join now/i }),
    page.getByLabel(/join/i),
    page.locator('[aria-label*="Ask to join"], [aria-label*="ask to join"]').first(),
    page.locator('[aria-label*="Join now"], [aria-label*="join now"]').first(),
    page.locator('[aria-label*="Join meeting"]').first(),
    page.locator('[data-tooltip*="Join"], [data-tooltip*="join"]').first(),
  ];

  for (const loc of roleLocators) {
    try {
      const first = loc.first();
      await first.waitFor({ state: "visible", timeout: 5000 });
      await first.scrollIntoViewIfNeeded().catch(() => {});
      await first.click({ timeout: 5000 });
      console.log("[meeting-joiner] clicked join control");
      return true;
    } catch {
      /* next */
    }
  }

  // Last resort: click visible text node (Meet wraps label in nested spans)
  for (const re of [/Ask to join/i, /Join now/i, /Join meeting/i]) {
    const t = page.getByText(re).first();
    try {
      await t.waitFor({ state: "visible", timeout: 5000 });
      await t.click({ timeout: 5000 });
      console.log("[meeting-joiner] clicked join via getByText");
      return true;
    } catch {
      /* next */
    }
  }

  return false;
}

/**
 * Navigate and click through Google Meet pre-join UI.
 * Selectors drift — try several patterns.
 */
export async function joinGoogleMeet(page: Page, meetUrl: string): Promise<void> {
  await page.goto(meetUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForLoadState("load", { timeout: 60_000 }).catch(() => {});
  console.log("[meeting-joiner] page loaded, waiting 6s for overlays to render…");
  await new Promise((r) => setTimeout(r, 6000));

  // Dismiss sign-in overlays aggressively — multiple passes with waits
  for (let i = 0; i < 4; i++) {
    await dismissOverlays(page);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Guest name field — try multiple selectors
  const nameSelectors = [
    'input[type="text"]',
    'input[placeholder*="name" i]',
    'input[aria-label*="name" i]',
    'input[aria-label*="Your name" i]',
  ];

  let nameEntered = false;
  for (const sel of nameSelectors) {
    const nameInput = page.locator(sel).first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.clear().catch(() => {});
      await nameInput.fill("Lucas").catch(() => {});
      console.log("[meeting-joiner] entered guest name via", sel);
      nameEntered = true;
      await new Promise((r) => setTimeout(r, 600));
      break;
    }
  }

  if (!nameEntered) {
    console.warn("[meeting-joiner] no name input found — may need sign-in");
  }

  await dismissOverlays(page);

  // Re-try join while Meet finishes loading (SPA)
  let clicked = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !clicked) {
    clicked = await tryClickJoin(page);
    if (clicked) break;
    await dismissOverlays(page);
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (!clicked) {
    console.warn(
      "[meeting-joiner] No join button matched — join manually in the opened window, or update selectors"
    );
  }

  // In-call: toolbar uses aria-labels; wording varies by locale/layout
  const inCallIndicators = [
    page.getByRole("button", { name: /leave call|end call|hang up|leave meeting/i }),
    page.locator('[aria-label*="Leave"], [aria-label*="leave"]').first(),
    page.locator('[aria-label*="End call"], [aria-label*="end call"]').first(),
    page.locator('[aria-label*="Hang up"], [aria-label*="hang up"]').first(),
    page.getByRole("button", { name: /^Leave$/i }),
    page.locator('[data-tooltip*="Leave"], [data-tooltip*="leave"]').first(),
    page.locator('[data-tooltip*="End call"], [data-tooltip*="end call"]').first(),
  ];

  let sawInCall = false;
  const leaveDeadline = Date.now() + 180_000;
  while (Date.now() < leaveDeadline && !sawInCall) {
    for (const loc of inCallIndicators) {
      const el = loc.first();
      if (await el.isVisible().catch(() => false)) {
        sawInCall = true;
        console.log("[meeting-joiner] in-call UI detected");
        break;
      }
    }
    if (!sawInCall) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!sawInCall) {
    console.warn(
      "[meeting-joiner] Leave/end control not seen — you may still be in the lobby; complete join manually if needed"
    );
  }
}
