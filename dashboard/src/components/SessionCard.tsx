"use client";

import { Phone, Video } from "lucide-react";
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
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
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

export function SessionCard(props: SessionCardProps) {
  const {
    variant,
    status,
    subtitle,
    messages,
    actionLabel,
    onAction,
    actionDisabled,
    secondaryLabel,
    onSecondaryAction,
    className,
  } = props;

  const isPhone = variant === "phone";
  const Icon = isPhone ? Phone : Video;
  const label = isPhone ? "Phone" : "Meeting";

  const headerGradient = isPhone
    ? "from-emerald-950/70 to-zinc-800"
    : "from-violet-950/70 to-zinc-800";

  const iconColor = isPhone ? "text-emerald-400" : "text-violet-400";

  return (
    <section
      className={[
        "w-full overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-800 shadow-xl",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header strip */}
      <div className={`bg-gradient-to-r ${headerGradient} px-5 py-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon size={15} className={iconColor} strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              {label}
            </span>
          </div>
          {variant === "phone" ? (
            <StatusBadge variant="phone" status={status} />
          ) : (
            <StatusBadge variant="meeting" status={status} />
          )}
        </div>
        {subtitle && (
          <p
            className="mt-1.5 truncate font-mono text-xs text-zinc-500"
            title={subtitle}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Transcript */}
      <div className="border-t border-zinc-700/60 px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Live Transcript
        </p>
        <LiveTranscript messages={messages} />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-zinc-700/60 px-4 py-3">
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="flex-1 rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-400 transition-colors hover:border-rose-700/60 hover:bg-rose-950/50 hover:text-rose-300 disabled:pointer-events-none disabled:opacity-40"
        >
          {actionLabel}
        </button>
        {secondaryLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-300"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </section>
  );
}
