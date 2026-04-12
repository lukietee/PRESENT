"use client";

import { useState } from "react";
import { Phone, Video, Copy, Check, Maximize2, X } from "lucide-react";
import { LiveTranscript, lineLabel } from "@/components/LiveTranscript";
import { StatusBadge } from "@/components/StatusBadge";
import { useElapsed } from "@/hooks/useElapsed";
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
  startedAt?: number | null;
  onApproveTool?: (id: string) => void;
  onDenyTool?: (id: string) => void;
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
    startedAt,
    onApproveTool,
    onDenyTool,
    className,
  } = props;

  const isPhone = variant === "phone";
  const Icon = isPhone ? Phone : Video;
  const label = isPhone ? "Phone" : "Meeting";
  const elapsed = useElapsed(startedAt ?? null);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  function handleCopy() {
    const text = messages
      .map((m) => `${lineLabel(m)}: ${m.content}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const headerBg = isPhone
    ? "bg-[var(--phone-header-bg)]"
    : "bg-[var(--meeting-header-bg)]";

  const iconColor = isPhone ? "text-accent-phone" : "text-accent-meeting";

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-background"
    : [
        "card-interactive card-interactive-hover w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <section className={containerClass}>
      <div className={`${headerBg} px-5 py-4 ${fullscreen ? "" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon size={15} className={iconColor} strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {elapsed && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {elapsed}
              </span>
            )}
            {variant === "phone" ? (
              <StatusBadge variant="phone" status={status} />
            ) : (
              <StatusBadge variant="meeting" status={status} />
            )}
            <button
              type="button"
              onClick={() => setFullscreen(!fullscreen)}
              className="ml-1 text-subtle transition-colors hover:text-muted-foreground"
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <X size={15} /> : <Maximize2 size={13} />}
            </button>
          </div>
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

      <div className={`border-t border-header-border px-4 py-3 ${fullscreen ? "flex-1 flex flex-col min-h-0" : ""}`}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
            Live Transcript
          </p>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-subtle transition-colors hover:text-muted-foreground"
              title="Copy transcript"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          )}
        </div>
        <LiveTranscript
          messages={messages}
          onApproveTool={onApproveTool}
          onDenyTool={onDenyTool}
          className={fullscreen ? "!max-h-none flex-1" : undefined}
        />
      </div>

      <div className={`flex items-center gap-2 border-t border-header-border px-4 py-3 ${fullscreen ? "pb-[env(safe-area-inset-bottom,0.75rem)]" : ""}`}>
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
