"use client";

import { useSocket } from "@/hooks/useSocket";

export function ConnectionStatus() {
  const { connected, hour0Test } = useSocket();

  const tooltipText = hour0Test
    ? `${hour0Test.message} — ${hour0Test.at}`
    : "Waiting for server ping…";

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-pill-border bg-pill-bg px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
      title={tooltipText}
    >
      {connected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-live opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-live" />
          </span>
          <span className="text-status-live">Connected</span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 animate-spin rounded-full border border-status-joining border-t-transparent motion-reduce:animate-none" />
          <span className="text-status-joining">Connecting…</span>
        </>
      )}
    </div>
  );
}
