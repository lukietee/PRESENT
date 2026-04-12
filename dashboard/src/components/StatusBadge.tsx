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
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live
      </span>
    );
  }

  if (status === "joining") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-amber-400 border-t-transparent" />
        Joining
      </span>
    );
  }

  // ended
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
      Ended
    </span>
  );
}
