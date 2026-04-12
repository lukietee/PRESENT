"use client";

import { useSocket } from "@/hooks/useSocket";

export function HourZeroStatus() {
  const { connected, hour0Test } = useSocket();

  return (
    <section className="w-full max-w-xl rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-left dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Hour 0 — Socket.IO
      </h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-zinc-500 dark:text-zinc-400">
            Connection
          </dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {connected ? "Connected" : "Connecting…"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-zinc-500 dark:text-zinc-400">
            Server test
          </dt>
          <dd className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
            {hour0Test
              ? `${hour0Test.message} — ${hour0Test.at}`
              : "Waiting for hour0:test…"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
