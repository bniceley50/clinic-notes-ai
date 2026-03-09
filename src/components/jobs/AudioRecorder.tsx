"use client";

import { useEffect, useRef } from "react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

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

  useEffect(() => {
    if (!blob || uploadedRef.current) return;
    uploadedRef.current = true;

    const file = new File([blob], "recording.webm", { type: blob.type });
    const form = new FormData();
    form.append("file", file);

    fetch(`/api/jobs/${jobId}/upload`, { method: "POST", body: form })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(body.error || `Upload failed (${res.status})`);
        }
        return res.json() as Promise<{ audio_storage_path: string }>;
      })
      .then((body) => {
        onUploaded(body.audio_storage_path);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Upload failed";
        console.error("AudioRecorder upload error:", msg);
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
        <button
          onClick={() => {
            uploadedRef.current = false;
            void start();
          }}
          className="flex w-full items-center justify-center gap-2 text-sm font-medium"
          style={{ color: "#517AB7" }}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z" />
            <path d="M19 11a1 1 0 00-2 0 5 5 0 01-10 0 1 1 0 00-2 0 7 7 0 006 6.93V20H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.07A7 7 0 0019 11z" />
          </svg>
          Start recording
        </button>
      )}

      {state === "requesting" && (
        <p className="text-center text-sm" style={{ color: "#746EB1" }}>
          Requesting microphone...
        </p>
      )}

      {(state === "recording" || state === "paused") && (
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
      )}

      {state === "stopped" && (
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "#746EB1" }}>
          <span
            className="h-3.5 w-3.5 rounded-full border-2 animate-spin"
            style={{ borderColor: "#746EB1", borderTopColor: "transparent" }}
          />
          Uploading recording...
        </div>
      )}

      {state === "error" && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: "#CC2200" }} role="alert">
            {error}
          </p>
          <button
            onClick={() => {
              uploadedRef.current = false;
              reset();
            }}
            className="text-xs font-medium underline"
            style={{ color: "#517AB7" }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}