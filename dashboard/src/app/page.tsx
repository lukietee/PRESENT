import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ActiveSessionsSection } from "@/components/ActiveSessionsSection";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-900 font-sans">
      <header className="sticky top-0 z-10 border-b border-zinc-700/60 bg-zinc-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight text-zinc-100">
              Present
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Live
            </span>
          </div>
          <ConnectionStatus />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Active Sessions
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Real-time calls and meetings in progress
          </p>
        </div>
        <ActiveSessionsSection />
      </main>
    </div>
  );
}
