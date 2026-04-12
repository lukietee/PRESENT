"use client";

import { useSocket } from "@/hooks/useSocket";

export function ConnectionStatus() {
  const { connected, hour0Test } = useSocket();

  const tooltipText = hour0Test
    ? `${hour0Test.message} — ${hour0Test.at}`
    : "Waiting for server ping…";

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
      title={tooltipText}
    >
      {connected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-emerald-400">Connected</span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 animate-spin rounded-full border border-amber-400 border-t-transparent" />
          <span className="text-amber-400">Connecting…</span>
        </>
      )}
    </div>
  );
}
