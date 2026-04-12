"use client";

import { Headphones } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 shadow-card">
      <Headphones
        size={36}
        className="animate-pulse-subtle text-muted-foreground"
        strokeWidth={1.5}
      />
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Waiting for calls...
        </p>
        <p className="mt-1 text-xs text-subtle">
          Sessions will appear here when a call starts or you join a meeting
        </p>
      </div>
    </div>
  );
}
