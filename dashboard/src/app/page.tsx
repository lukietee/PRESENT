import { HourZeroStatus } from "@/components/HourZeroStatus";
import { SessionMockSection } from "@/components/SessionMockSection";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Present
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Hour 1.5 — mock active sessions below. Socket.IO smoke test stays on the page until
            hour 2 wiring.
          </p>
        </div>
        <HourZeroStatus />
        <section className="flex w-full max-w-xl flex-col gap-4">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Active sessions
          </h2>
          <SessionMockSection />
        </section>
      </main>
    </div>
  );
}
