"use client";

import type { Toast as ToastType } from "@/hooks/useToast";

type ToastContainerProps = {
  toasts: ToastType[];
};

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-toast-in rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-medium shadow-card ${
            toast.variant === "error" ? "text-danger" : "text-foreground"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
