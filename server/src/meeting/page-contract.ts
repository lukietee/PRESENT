/**
 * Single source of truth for in-page globals and Playwright exposeFunction names.
 * Import these everywhere (media-inject, heygen inject, integration) — do not duplicate strings.
 */

/** `window[WINDOW_AVATAR_CANVAS]` — HTMLCanvasElement */
export const WINDOW_AVATAR_CANVAS = "__presentAvatarCanvas";

/** `window[WINDOW_AVATAR_CTX]` — CanvasRenderingContext2D */
export const WINDOW_AVATAR_CTX = "__presentAvatarCtx";

/** `window[WINDOW_AUDIO_DESTINATION]` — MediaStreamAudioDestinationNode */
export const WINDOW_AUDIO_DESTINATION = "__presentAudioDestination";

/** `window[WINDOW_MEETING_MIC_SOURCES]` — AudioBufferSourceNode[] (active injected mic playback) */
export const WINDOW_MEETING_MIC_SOURCES = "__presentMeetingMicSources";

/**
 * Playwright `page.exposeFunction(EXPOSE_PUSH_MEETING_PCM, handler)` — in page, call as a global function with that name.
 */
export const EXPOSE_PUSH_MEETING_PCM = "presentPushMeetingPcm";
