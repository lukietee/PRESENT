"use client";

type ToolApprovalProps = {
  toolId: string;
  content: string;
  status: "pending" | "approved" | "denied";
  timestamp?: string;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
};

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ToolApproval({
  toolId,
  content,
  status,
  timestamp,
  onApprove,
  onDeny,
}: ToolApprovalProps) {
  const isPending = status === "pending";

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-sm rounded-lg border border-amber-800/30 bg-amber-950/40 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-amber-300">{content}</span>
          {timestamp && (
            <span className="shrink-0 text-[10px] text-amber-300/50">
              {formatTime(timestamp)}
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          {isPending ? (
            <>
              <button
                type="button"
                onClick={() => onApprove(toolId)}
                className="flex-1 rounded-md bg-accent-phone/20 px-3 py-1.5 text-xs font-semibold text-accent-phone transition-colors hover:bg-accent-phone/30"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => onDeny(toolId)}
                className="flex-1 rounded-md border border-secondary-btn-border bg-secondary-btn-bg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary-btn-hover-bg"
              >
                Deny
              </button>
            </>
          ) : (
            <span
              className={`text-xs font-medium ${
                status === "approved"
                  ? "text-accent-phone"
                  : "text-muted-foreground"
              }`}
            >
              {status === "approved" ? "Approved" : "Denied"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
