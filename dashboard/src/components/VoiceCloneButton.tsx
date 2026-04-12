"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { VoiceCloneModal } from "@/components/VoiceCloneModal";

export function VoiceCloneButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Mic size={13} />
        Clone Voice
      </button>
      <VoiceCloneModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
