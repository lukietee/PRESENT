"use client";

import { LiveTranscript } from "@/components/LiveTranscript";
import { StatusBadge } from "@/components/StatusBadge";
import type {
  MeetingSessionStatus,
  PhoneSessionStatus,
  TranscriptLine,
} from "@/types/session";

type SessionCardBase = {
  messages: TranscriptLine[];
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  className?: string;
};

export type SessionCardProps =
  | (SessionCardBase & {
      variant: "phone";
      status: PhoneSessionStatus;
      subtitle: string;
    })
  | (SessionCardBase & {
      variant: "meeting";
      status: MeetingSessionStatus;
      subtitle: string;
    });

const headingClass =
  "text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export function SessionCard(props: SessionCardProps) {
  const {
    variant,
    status,
    subtitle,
    messages,
    actionLabel,
    onAction,
    actionDisabled,
    className,
  } = props;

  const label = variant === "phone" ? "Phone" : "Meeting";

  return (
    <section
      className={[
        "w-full max-w-xl rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-left dark:border-zinc-800 dark:bg-zinc-950",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className={headingClass}>{label}</h2>
          {variant === "phone" ? (
            <StatusBadge variant="phone" status={status} />
          ) : (
            <StatusBadge variant="meeting" status={status} />
          )}
        </div>
        {subtitle ? (
          <p
            className="max-w-full min-w-0 flex-1 basis-full text-right text-xs font-medium text-zinc-600 truncate sm:basis-auto sm:max-w-[50%] dark:text-zinc-400"
            title={subtitle}
          >
            {subtitle}
          </p>
        ) : null}
      </header>

      <div className="mt-4">
        <LiveTranscript messages={messages} className="max-w-none" />
      </div>

      <footer className="mt-4">
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-emerald-300/80 hover:bg-emerald-50/60 hover:text-emerald-900 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/35 dark:hover:text-emerald-200"
        >
          {actionLabel}
        </button>
      </footer>
    </section>
  );
}
