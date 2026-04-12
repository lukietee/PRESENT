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
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
        title="Clone your voice"
      >
        <Mic size={14} />
      </button>
      <VoiceCloneModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
