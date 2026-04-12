"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="m-auto max-w-sm rounded-2xl border border-border bg-card p-0 shadow-card backdrop:bg-black/50 backdrop:backdrop-blur-sm animate-dialog-enter"
    >
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2 border-t border-header-border px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-10 flex-1 items-center justify-center rounded-lg border border-secondary-btn-border bg-secondary-btn-bg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-secondary-btn-hover-border hover:bg-secondary-btn-hover-bg hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex min-h-10 flex-1 items-center justify-center rounded-lg border border-danger-border bg-danger-muted px-4 py-2 text-xs font-semibold text-danger transition-colors hover:border-danger-hover-border hover:bg-danger-hover-bg"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
