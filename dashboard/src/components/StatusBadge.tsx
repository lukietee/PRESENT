import type {
  MeetingSessionStatus,
  PhoneSessionStatus,
} from "@/types/session";

export type StatusBadgeProps =
  | { variant: "phone"; status: PhoneSessionStatus }
  | { variant: "meeting"; status: MeetingSessionStatus };

const basePill =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

function stylesForStatus(
  status: PhoneSessionStatus | MeetingSessionStatus
): string {
  switch (status) {
    case "joining":
      return "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";
    case "active":
      return "border-emerald-200/90 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
    case "ended":
      return "border-zinc-200 bg-zinc-50 text-rose-700/90 dark:border-zinc-800 dark:bg-zinc-950 dark:text-rose-400/90";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function labelForStatus(
  status: PhoneSessionStatus | MeetingSessionStatus
): string {
  switch (status) {
    case "joining":
      return "JOINING";
    case "active":
      return "LIVE";
    case "ended":
      return "ENDED";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function StatusBadge(props: StatusBadgeProps) {
  const { status } = props;
  return (
    <span className={`${basePill} ${stylesForStatus(status)}`}>
      {labelForStatus(status)}
    </span>
  );
}
