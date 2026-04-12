"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Upload, FileAudio } from "lucide-react";

const SAMPLE_TEXT =
  "Hey, thanks for calling! I'm just looking over the project notes right now. The revenue charts are about eighty percent done, and we still need to wire up the export feature. Let me pull up the latest file and send it your way. Sound good?";

const API_BASE =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

type VoiceCloneModalProps = {
  open: boolean;
  onClose: () => void;
};

export function VoiceCloneModal({ open, onClose }: VoiceCloneModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function reset() {
    setRecording(false);
    setElapsed(0);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setCloning(false);
    setDone(false);
    setError(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
      setRecording(true);
      setElapsed(0);

      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } catch (err: any) {
      setError("Could not access microphone. Check browser permissions.");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function cloneVoice() {
    if (!audioBlob) return;
    setCloning(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("audio", audioBlob, "recording.webm");

      const res = await fetch(`${API_BASE}/api/voice/clone`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }

      setDone(true);
    } catch (err: any) {
      setError(err.message || "Voice cloning failed");
    } finally {
      setCloning(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="m-auto max-w-md rounded-2xl border border-border bg-card p-0 shadow-card backdrop:bg-black/50 backdrop:backdrop-blur-sm animate-dialog-enter"
    >
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-base font-semibold text-foreground">
          {done ? "Voice Cloned!" : "Clone Your Voice"}
        </h2>

        {done ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Your voice has been cloned successfully. The agent will now use your
            voice when answering phone calls.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Read the following paragraph out loud. Speak naturally, as if
              you&apos;re on a phone call.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground">
              {SAMPLE_TEXT}
            </div>

            {error && (
              <p className="mt-3 text-xs text-danger">{error}</p>
            )}

            {!audioBlob && !recording && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent-phone/20 px-4 py-2.5 text-xs font-semibold text-accent-phone transition-colors hover:bg-accent-phone/30"
                >
                  <Mic size={15} />
                  Record
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-secondary-btn-border bg-secondary-btn-bg px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary-btn-hover-bg hover:text-foreground"
                >
                  <FileAudio size={15} />
                  Upload MP3
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {recording && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse" />
                  <span className="font-mono text-sm tabular-nums text-foreground">
                    {mm}:{ss}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex w-full min-h-11 items-center justify-center gap-2 rounded-lg border border-danger-border bg-danger-muted px-4 py-2.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-hover-bg"
                >
                  <Square size={13} />
                  Stop Recording
                </button>
              </div>
            )}

            {audioBlob && !recording && (
              <div className="mt-4 flex flex-col gap-3">
                <audio
                  src={audioUrl ?? undefined}
                  controls
                  className="w-full h-10"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={cloning}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-secondary-btn-border bg-secondary-btn-bg px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary-btn-hover-bg disabled:opacity-40"
                  >
                    <RotateCcw size={13} />
                    Re-record
                  </button>
                  <button
                    type="button"
                    onClick={cloneVoice}
                    disabled={cloning}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent-phone/20 px-4 py-2.5 text-xs font-semibold text-accent-phone transition-colors hover:bg-accent-phone/30 disabled:opacity-40"
                  >
                    {cloning ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-phone border-t-transparent" />
                        Cloning...
                      </>
                    ) : (
                      <>
                        <Upload size={13} />
                        Clone Voice
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-end border-t border-header-border px-6 py-4">
        <button
          type="button"
          onClick={handleClose}
          className="min-h-10 rounded-lg border border-secondary-btn-border bg-secondary-btn-bg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary-btn-hover-bg hover:text-foreground"
        >
          {done ? "Done" : "Cancel"}
        </button>
      </div>
    </dialog>
  );
}
