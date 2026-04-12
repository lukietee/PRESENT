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
    <section className="card-interactive card-interactive-hover w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="bg-[var(--meeting-header-bg)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Video size={15} className="text-accent-meeting" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Meeting
            </span>
          </div>
          <span className="inline-flex items-center rounded-full border border-meeting-pill-border bg-meeting-pill-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-meeting-pill-text">
            Ready
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Paste a Google Meet link to join as the agent
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="border-t border-header-border px-4 py-4">
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
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-placeholder focus:border-accent-meeting/50 focus:outline-none focus:ring-2 focus:ring-accent-meeting/40 disabled:opacity-50"
          />
          {disabled && (
            <p className="mt-2 text-[11px] text-status-joining">
              Connect to the server to join a meeting.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-header-border px-4 py-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-meeting-cta-border bg-meeting-cta-bg px-4 py-2.5 text-xs font-semibold text-meeting-pill-text transition-colors hover:border-meeting-cta-hover-border hover:bg-meeting-cta-hover-bg disabled:pointer-events-none disabled:opacity-40"
          >
            {isPending ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none"
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
