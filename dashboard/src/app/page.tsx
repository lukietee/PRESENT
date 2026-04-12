import { Phone } from "lucide-react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ActiveSessionsSection } from "@/components/ActiveSessionsSection";
import { PastSessionsWrapper } from "@/components/PastSessionsWrapper";
import { VoiceCloneButton } from "@/components/VoiceCloneButton";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background font-sans">
      <header className="sticky top-0 z-10 border-b border-header-border bg-header-bg backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-accent-phone" strokeWidth={2} />
              <span className="truncate text-lg font-semibold tracking-tight text-foreground">
                Present!
              </span>
            </div>
            <span className="shrink-0 rounded-full border border-pill-live-border bg-pill-live-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-pill-live-text">
              Live
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <VoiceCloneButton />
            <ConnectionStatus />
          </div>
        </div>
      </header>

      <main className="animate-enter mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Active Sessions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time calls and meetings in progress
          </p>
        </div>
        <ActiveSessionsSection />

        <div className="mt-12 mb-8">
          <h2 className="text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Past Sessions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Previous calls and meetings
          </p>
        </div>
        <PastSessionsWrapper />
      </main>
    </div>
  );
}
