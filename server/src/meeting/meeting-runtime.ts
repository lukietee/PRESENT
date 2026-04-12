import type { BrowserContext, Page } from "playwright";
import { setMeetingCoordinator, type MeetingCoordinator } from "./coordinator.js";
import type { MeetingRunContext } from "./types.js";
import { launchMeetingBrowser, joinGoogleMeet } from "./meeting-joiner.js";
import {
  registerMeetingMediaOnContext,
  playPcm48kToMeetingMic,
  stopAllMeetingMicPlayback,
} from "./media-inject.js";
import {
  createMeetingDeepgramStream,
  sendMeetingPcm,
  closeMeetingDeepgramStream,
} from "./deepgram-meeting.js";
import { LiveAvatarSession } from "./heygen-avatar.js";
import {
  handleMeetingTranscript,
  bumpMeetingConversationEpoch,
  clearMeetingBrainState,
} from "../brain/meeting-orchestrator.js";
import { appendMeetingTranscript } from "./socket-handlers.js";

let browserCtx: BrowserContext | null = null;
let meetPage: Page | null = null;
let avatar: LiveAvatarSession | null = null;
let deepgramSessionId: string | null = null;

async function cleanupMeetingResources(): Promise<void> {
  if (deepgramSessionId) {
    clearMeetingBrainState(deepgramSessionId);
    closeMeetingDeepgramStream(deepgramSessionId);
    deepgramSessionId = null;
  }
  if (avatar) {
    await avatar.stop();
    avatar = null;
  }
  if (browserCtx) {
    await browserCtx.close().catch((e) => {
      console.error("[meeting-runtime] context close:", e);
    });
    browserCtx = null;
  }
  meetPage = null;
}

/**
 * Installs the real MeetingCoordinator (join Meet → media → LiveAvatar → Deepgram → brain).
 * Call once at process startup after `registerMeetingSocketHandlers(io)`.
 */
export function installMeetingRuntime(): void {
  const coordinator: MeetingCoordinator = {
    async startJoin(url: string, ctx: MeetingRunContext) {
      const { io: socketIo, meetingId } = ctx;
      if (browserCtx) {
        throw new Error("Meeting browser already active");
      }

      browserCtx = await launchMeetingBrowser();

      await registerMeetingMediaOnContext(browserCtx, (buf) => {
        if (deepgramSessionId) {
          sendMeetingPcm(deepgramSessionId, buf);
        }
      });

      meetPage = browserCtx.pages()[0] ?? (await browserCtx.newPage());

      console.log("[meeting-runtime] waiting 3s before navigating to Meet…");
      await new Promise((r) => setTimeout(r, 3000));
      await joinGoogleMeet(meetPage, url);

      avatar = new LiveAvatarSession();
      const avatarOk = await avatar.start();
      if (!avatarOk) {
        await cleanupMeetingResources();
        throw new Error(
          "LiveAvatar session failed — set HEYGEN_API_KEY and HEYGEN_AVATAR_ID, check server logs"
        );
      }

      await avatar.attachVideoToPage(meetPage);

      deepgramSessionId = meetingId;

      const sinks = {
        toMeetMic: async (pcm48: Buffer) => {
          if (meetPage) {
            await playPcm48kToMeetingMic(meetPage, pcm48, 48000);
          }
        },
        toHeyGen: (pcm24: Buffer) => {
          avatar?.speakPcmBase64(pcm24);
        },
      };

      await createMeetingDeepgramStream(meetingId, socketIo, (sid, transcript, io2) => {
        const replyEpoch = bumpMeetingConversationEpoch(sid);
        void (async () => {
          if (meetPage) {
            await stopAllMeetingMicPlayback(meetPage);
          }
          avatar?.interruptSpeak();
          appendMeetingTranscript(io2, { role: "participant", content: transcript });
          void handleMeetingTranscript(sid, transcript, io2, sinks, replyEpoch);
        })();
      });
    },

    async leave() {
      await cleanupMeetingResources();
    },
  };

  setMeetingCoordinator(coordinator);
}

export async function shutdownMeetingRuntime(): Promise<void> {
  await cleanupMeetingResources();
}
