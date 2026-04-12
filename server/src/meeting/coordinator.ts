import type { MeetingRunContext } from "./types.js";

/**
 * Orchestrates join → inject → HeyGen → Deepgram → brain. Stub until integration implements full flow.
 */
export interface MeetingCoordinator {
  startJoin(url: string, ctx: MeetingRunContext): Promise<void>;
  leave(): Promise<void>;
}

const stubCoordinator: MeetingCoordinator = {
  async startJoin(url: string) {
    console.log("[meeting-coordinator] stub startJoin", url);
  },
  async leave() {
    console.log("[meeting-coordinator] stub leave");
  },
};

let coordinator: MeetingCoordinator = stubCoordinator;

export function getMeetingCoordinator(): MeetingCoordinator {
  return coordinator;
}

/** Used by integration to replace the stub with the real pipeline. */
export function setMeetingCoordinator(next: MeetingCoordinator): void {
  coordinator = next;
}
