import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import type { Page } from "playwright";
import { config } from "../config.js";
import {
  WINDOW_AVATAR_CANVAS,
  WINDOW_AVATAR_CTX,
} from "./page-contract.js";

const TOKEN_URL = "https://api.liveavatar.com/v1/sessions/token";
const START_URL = "https://api.liveavatar.com/v1/sessions/start";
const DEFAULT_WS_BASE = "wss://api.liveavatar.com/v1/ws";
const KEEP_ALIVE_MS = 30_000;
/** Max raw PCM bytes per `agent.speak` message (before base64). */
const SPEAK_CHUNK_BYTES = 32 * 1024;

function logJsonError(context: string, body: unknown): void {
  try {
    console.error(`[heygen-avatar] ${context}`, JSON.stringify(body));
  } catch {
    console.error(`[heygen-avatar] ${context}`, body);
  }
}

function pickString(root: unknown, keys: string[]): string | undefined {
  if (!root || typeof root !== "object") return undefined;
  const o = root as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  const data = o.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of keys) {
      const v = d[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
  }
  return undefined;
}

function resolveLivekitUmdPath(): string {
  const meetingDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(meetingDir, "../../..");
  const candidates = [
    path.join(repoRoot, "node_modules/livekit-client/dist/livekit-client.umd.js"),
    path.join(
      repoRoot,
      "server/node_modules/livekit-client/dist/livekit-client.umd.js"
    ),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  throw new Error(
    `[heygen-avatar] livekit-client.umd.js not found. Tried:\n${candidates.join("\n")}`
  );
}

export class LiveAvatarSession {
  private ws: WebSocket | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private sessionToken = "";
  private livekitUrl = "";
  private livekitToken = "";

  async start(): Promise<boolean> {
    const apiKey = config.heygen.apiKey;
    const avatarId = config.heygen.avatarId;
    if (!apiKey) {
      console.error("[heygen-avatar] HEYGEN_API_KEY is missing");
      return false;
    }
    if (!avatarId) {
      console.error("[heygen-avatar] HEYGEN_AVATAR_ID is missing");
      return false;
    }

    let tokenRes: Response;
    try {
      tokenRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "LITE", avatar_id: avatarId }),
      });
    } catch (e) {
      console.error("[heygen-avatar] token request failed", e);
      return false;
    }

    let tokenJson: unknown;
    try {
      tokenJson = await tokenRes.json();
    } catch (e) {
      console.error("[heygen-avatar] token response not JSON", e);
      return false;
    }
    if (!tokenRes.ok) {
      logJsonError("token HTTP error", tokenJson);
      return false;
    }

    const sessionToken = pickString(tokenJson, [
      "session_token",
      "access_token",
      "token",
    ]);

    if (!sessionToken) {
      logJsonError("token response missing session_token", tokenJson);
      return false;
    }
    this.sessionToken = sessionToken;

    let startRes: Response;
    try {
      startRes = await fetch(START_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
    } catch (e) {
      console.error("[heygen-avatar] start request failed", e);
      return false;
    }

    let startJson: unknown;
    try {
      startJson = await startRes.json();
    } catch (e) {
      console.error("[heygen-avatar] start response not JSON", e);
      return false;
    }
    if (!startRes.ok) {
      logJsonError("start HTTP error", startJson);
      return false;
    }

    const livekitUrl = pickString(startJson, ["livekit_url"]);
    const livekitToken = pickString(startJson, ["livekit_token"]);
    if (!livekitUrl || !livekitToken) {
      logJsonError("start response missing livekit_url / livekit_token", startJson);
      return false;
    }
    this.livekitUrl = livekitUrl;
    this.livekitToken = livekitToken;

    const wsFromApi = pickString(startJson, ["websocket_url", "ws_url"]);
    const wsUrl =
      wsFromApi ??
      `${DEFAULT_WS_BASE}?session_token=${encodeURIComponent(sessionToken)}`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error("[heygen-avatar] WebSocket construct failed", e);
      logJsonError("start payload for context", startJson);
      return false;
    }

    this.ws.on("error", (err) => {
      console.error("[heygen-avatar] WebSocket error", err);
    });

    this.ws.on("message", (data) => {
      try {
        const text = data.toString();
        const parsed = JSON.parse(text) as { error?: unknown };
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          logJsonError("WebSocket message error", parsed);
        }
      } catch {
        /* non-JSON message — ignore */
      }
    });

    const WS_OPEN_TIMEOUT_MS = 20_000;
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = this.ws!;
        const timer = setTimeout(() => {
          socket.off("open", onOpen);
          socket.off("error", onErr);
          reject(new Error("LiveAvatar WebSocket open timeout"));
        }, WS_OPEN_TIMEOUT_MS);
        const onOpen = () => {
          clearTimeout(timer);
          socket.off("error", onErr);
          resolve();
        };
        const onErr = (e: Error) => {
          clearTimeout(timer);
          socket.off("open", onOpen);
          reject(e);
        };
        socket.once("open", onOpen);
        socket.once("error", onErr);
      });
    } catch (e) {
      console.error("[heygen-avatar] WebSocket connect failed", e);
      logJsonError("start payload for context", startJson);
      await this.stop();
      return false;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.stop();
      return false;
    }

    this.keepAliveTimer = setInterval(() => {
      try {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "session.keep_alive" }));
        }
      } catch (e) {
        console.error("[heygen-avatar] keep_alive send failed", e);
      }
    }, KEEP_ALIVE_MS);

    console.log("[heygen-avatar] session ready (WS + keep_alive)");
    return true;
  }

  speakPcmBase64(pcm: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[heygen-avatar] speakPcmBase64: WebSocket not open");
      return;
    }
    try {
      for (let i = 0; i < pcm.length; i += SPEAK_CHUNK_BYTES) {
        const slice = pcm.subarray(i, i + SPEAK_CHUNK_BYTES);
        const b64 = slice.toString("base64");
        this.ws.send(
          JSON.stringify({ type: "agent.speak", data: { audio: b64 } })
        );
      }
      this.ws.send(JSON.stringify({ type: "agent.speak_end" }));
    } catch (e) {
      console.error("[heygen-avatar] speakPcmBase64 failed", e);
    }
  }

  /**
   * Request the avatar to stop current speech (barge-in / cancel).
   * If the WebSocket is not open, does nothing.
   */
  interruptSpeak(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      // LiveAvatar agent WS message names are not fully documented publicly; this matches the agent.speak / agent.speak_end pattern used above.
      this.ws.send(JSON.stringify({ type: "agent.speak_interrupt" }));
      // Same end marker as speakPcmBase64 — helps flush any buffered speak pipeline; safe no-op if the server already ended the stream.
      this.ws.send(JSON.stringify({ type: "agent.speak_end" }));
    } catch (e) {
      console.error("[heygen-avatar] interruptSpeak failed", e);
    }
  }

  async attachVideoToPage(page: Page): Promise<void> {
    const url = this.livekitUrl;
    const token = this.livekitToken;
    if (!url || !token) {
      console.error(
        "[heygen-avatar] attachVideoToPage: missing livekit url/token — call start() first"
      );
      return;
    }

    let scriptPath: string;
    try {
      scriptPath = resolveLivekitUmdPath();
    } catch (e) {
      console.error(e);
      return;
    }

    try {
      await page.addScriptTag({ path: scriptPath });
    } catch (e) {
      console.error("[heygen-avatar] addScriptTag failed", e);
      return;
    }

    const ctxKey = WINDOW_AVATAR_CTX;
    const canvasKey = WINDOW_AVATAR_CANVAS;

    try {
      await page.evaluate(
        async (cfg: {
          url: string;
          token: string;
          ctxKey: string;
          canvasKey: string;
        }) => {
          const W = 1280;
          const H = 720;
          try {
            const canvas = window[cfg.canvasKey as keyof Window] as
              | HTMLCanvasElement
              | undefined;
            if (canvas) {
              canvas.width = W;
              canvas.height = H;
            }

            const LivekitClient = (
              window as unknown as {
                LivekitClient?: {
                  Room: new (opts?: object) => {
                    connect: (u: string, t: string) => Promise<void>;
                    on: (ev: unknown, fn: (...args: unknown[]) => void) => void;
                  };
                  RoomEvent: { TrackSubscribed: string };
                  Track: { Kind?: { Video: string } };
                };
              }
            ).LivekitClient;

            if (!LivekitClient?.Room) {
              console.error(
                "[heygen-avatar] window.LivekitClient.Room missing",
                LivekitClient
              );
              return;
            }

            const { Room, RoomEvent } = LivekitClient;
            const room = new Room({});

            let raf = 0;
            let videoEl: HTMLVideoElement | null = null;

            room.on(RoomEvent.TrackSubscribed, (...args: unknown[]) => {
              const track = args[0] as {
                kind: string | number;
                attach: (el: HTMLVideoElement) => void;
              };
              const kindStr = String(track.kind).toLowerCase();
              if (!kindStr.includes("video")) {
                return;
              }
              videoEl = document.createElement("video");
              videoEl.autoplay = true;
              videoEl.muted = true;
              videoEl.playsInline = true;
              track.attach(videoEl);

              const ctx = window[cfg.ctxKey as keyof Window] as
                | CanvasRenderingContext2D
                | undefined;
              if (!ctx) {
                console.error(
                  "[heygen-avatar] missing canvas ctx on window",
                  cfg.ctxKey
                );
                return;
              }

              const draw = () => {
                if (videoEl && videoEl.readyState >= 2) {
                  try {
                    ctx.drawImage(videoEl, 0, 0, W, H);
                  } catch (e) {
                    console.error("[heygen-avatar] drawImage", e);
                  }
                }
                raf = requestAnimationFrame(draw);
              };
              cancelAnimationFrame(raf);
              raf = requestAnimationFrame(draw);
            });

            await room.connect(cfg.url, cfg.token);
          } catch (e) {
            console.error("[heygen-avatar] attachVideoToPage evaluate", e);
          }
        },
        { url, token, ctxKey, canvasKey }
      );
    } catch (e) {
      console.error("[heygen-avatar] page.evaluate failed", e);
    }
  }

  async stop(): Promise<void> {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.error("[heygen-avatar] ws close", e);
      }
      this.ws = null;
    }
    this.sessionToken = "";
    this.livekitUrl = "";
    this.livekitToken = "";
  }
}
