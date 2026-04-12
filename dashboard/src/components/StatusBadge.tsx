import type {
  MeetingSessionStatus,
  PhoneSessionStatus,
} from "@/types/session";

export type StatusBadgeProps =
  | { variant: "phone"; status: PhoneSessionStatus }
  | { variant: "meeting"; status: MeetingSessionStatus };

export function StatusBadge(props: StatusBadgeProps) {
  const { status } = props;

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-status-live">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-live opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-status-live" />
        </span>
        Live
      </span>
    );
  }

  if (status === "joining") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-status-joining">
        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-status-joining border-t-transparent motion-reduce:animate-none" />
        Joining
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-badge-ended-border bg-badge-ended-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-badge-ended-text">
      Ended
    </span>
  );
}
