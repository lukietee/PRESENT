import { HourZeroStatus } from "@/components/HourZeroStatus";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Present
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Dashboard (hour 0: verify server → client over Socket.IO).
          </p>
        </div>
        <HourZeroStatus />
      </main>
    </div>
  );
}
