"use client";

import { useEffect, useRef, useState } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { uploadAudioForJobDirect } from "@/lib/storage/audio-upload-client";

type Props = {
  jobId: string;
  onUploaded: (storagePath: string) => void;
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioRecorder({ jobId, onUploaded }: Props) {
  const { state, elapsed, blob, error, start, pause, resume, stop, reset } = useAudioRecorder();
  const uploadedRef = useRef(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!blob || uploadedRef.current) return;
    uploadedRef.current = true;

    const file = new File([blob], "recording.webm", { type: blob.type || "audio/webm" });

    uploadAudioForJobDirect(jobId, file)
      .then((storagePath) => {
        onUploaded(storagePath);
      })
      .catch((uploadError: unknown) => {
        const msg = uploadError instanceof Error ? uploadError.message : "Upload failed";
        setUploadError(msg);
        uploadedRef.current = false;
        reset();
      });
  }, [blob, jobId, onUploaded, reset]);

  return (
    <div
      className="mt-3 p-3"
      data-testid="audio-recorder-panel"
      style={{
        border: "1px dashed #746EB1",
        borderRadius: "2px",
        backgroundColor: "#F9F9FF",
      }}
    >
      {state === "idle" && (
        <div className="space-y-2">
          <button
            onClick={() => {
              uploadedRef.current = false;
              setUploadError(null);
              void start();
            }}
            className="flex w-full items-center justify-center gap-2 text-sm font-medium text-accent"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z" />
              <path d="M19 11a1 1 0 00-2 0 5 5 0 01-10 0 1 1 0 00-2 0 7 7 0 006 6.93V20H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.07A7 7 0 0019 11z" />
            </svg>
            Start recording
          </button>
          <p className="text-center text-xs text-text-muted">
            Chrome and Edge work best. The recording uploads automatically when you stop.
          </p>
        </div>
      )}

      {state === "requesting" && (
        <p className="text-center text-sm text-secondary">
          Requesting microphone...
        </p>
      )}

      {(state === "recording" || state === "paused") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium" style={{ color: state === "paused" ? "#746EB1" : "#CC2200" }}>
              <span
                className={`h-2 w-2 rounded-full ${state === "recording" ? "animate-pulse" : ""}`}
                style={{ backgroundColor: state === "paused" ? "#746EB1" : "#CC2200" }}
              />
              {state === "paused" ? `Paused ${formatElapsed(elapsed)}` : `Recording ${formatElapsed(elapsed)}`}
            </span>
            <div className="flex items-center gap-2">
              {state === "recording" ? (
                <button
                  onClick={pause}
                  className="rounded px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: "#E7E9EC", color: "#517AB7" }}
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={resume}
                  className="rounded px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: "#3B276A", color: "#FFFFFF" }}
                >
                  Resume
                </button>
              )}
              <button
                onClick={stop}
                className="rounded px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: "#CC2200", color: "#FFFFFF" }}
              >
                Stop
              </button>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Microphone is live. Speak normally, then press Stop to finalize and upload.
          </p>
        </div>
      )}

      {state === "stopped" && (
        <div className="flex items-center justify-center gap-2 text-sm text-secondary">
          <span
            className="h-3.5 w-3.5 rounded-full border-2 animate-spin"
            style={{ borderColor: "#746EB1", borderTopColor: "transparent" }}
          />
          Finalizing and uploading recording...
        </div>
      )}

      {(state === "error" || uploadError) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-alert" role="alert">
            {error ?? uploadError}
          </p>
          <button
            onClick={() => {
              uploadedRef.current = false;
              setUploadError(null);
              reset();
            }}
            className="text-xs font-medium underline text-accent"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
