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
    ? "from-[var(--phone-gradient-from)] to-[var(--phone-gradient-to)]"
    : "from-[var(--meeting-gradient-from)] to-[var(--meeting-gradient-to)]";

  const iconColor = isPhone ? "text-accent-phone" : "text-accent-meeting";

  return (
    <section
      className={[
        "card-interactive card-interactive-hover w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`bg-gradient-to-r ${headerGradient} px-5 py-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon size={15} className={iconColor} strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
            className="mt-1.5 truncate font-mono text-xs text-subtle"
            title={subtitle}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div className="border-t border-header-border px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
          Live Transcript
        </p>
        <LiveTranscript messages={messages} />
      </div>

      <div className="flex items-center gap-2 border-t border-header-border px-4 py-3">
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-danger-border bg-danger-muted px-4 py-2.5 text-xs font-semibold text-danger transition-colors hover:border-danger-hover-border hover:bg-danger-hover-bg hover:text-danger disabled:pointer-events-none disabled:opacity-40"
        >
          {actionLabel}
        </button>
        {secondaryLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="min-h-11 rounded-lg border border-secondary-btn-border bg-secondary-btn-bg px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-secondary-btn-hover-border hover:bg-secondary-btn-hover-bg hover:text-foreground"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </section>
  );
}
