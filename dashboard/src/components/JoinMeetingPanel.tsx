"use client";

import { useState } from "react";
import { Loader2, Video } from "lucide-react";

export type JoinMeetingPanelProps = {
  onJoin: (url: string) => void;
  disabled?: boolean;
};

export function JoinMeetingPanel({ onJoin, disabled }: JoinMeetingPanelProps) {
  const [url, setUrl] = useState("");
  const [isPending, setIsPending] = useState(false);

  const trimmed = url.trim();
  const canSubmit = trimmed.length > 0 && !disabled && !isPending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsPending(true);
    onJoin(trimmed);
  }

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-800 shadow-xl">
      <div className="bg-gradient-to-r from-violet-950/70 to-zinc-800 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Video size={15} className="text-violet-400" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Meeting
            </span>
          </div>
          <span className="inline-flex items-center rounded-full border border-violet-800/60 bg-violet-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
            Ready
          </span>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          Paste a Google Meet link to join as the agent
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="border-t border-zinc-700/60 px-4 py-4">
          <label htmlFor="meeting-url" className="sr-only">
            Meeting URL
          </label>
          <input
            id="meeting-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://meet.google.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={disabled || isPending}
            className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2.5 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-violet-600/50 focus:outline-none focus:ring-1 focus:ring-violet-600/40 disabled:opacity-50"
          />
          {disabled && (
            <p className="mt-2 text-[11px] text-amber-500/90">
              Connect to the server to join a meeting.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-zinc-700/60 px-4 py-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-800/60 bg-violet-950/35 px-4 py-2 text-xs font-semibold text-violet-200 transition-colors hover:border-violet-600/60 hover:bg-violet-950/55 hover:text-violet-100 disabled:pointer-events-none disabled:opacity-40"
          >
            {isPending ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin"
                  aria-hidden
                />
                Joining…
              </>
            ) : (
              "Join Meeting"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
