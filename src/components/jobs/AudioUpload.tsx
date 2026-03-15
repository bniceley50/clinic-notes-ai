"use client";

import { useState, useRef, type ChangeEvent } from "react";
import {
  uploadAudioForJobDirect,
  validateAudioFile,
} from "@/lib/storage/audio-upload-client";

type Props = {
  jobId: string;
  onUploaded: (storagePath: string) => void;
};

const ACCEPTED_TYPES = ".webm,.mp3,.mp4,.m4a,.wav,.ogg,audio/webm,audio/mp4,audio/mpeg,audio/mp3,audio/x-m4a,audio/m4a,audio/ogg,audio/wav,audio/x-wav";

export function AudioUpload({ jobId, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const validationError = await validateAudioFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);

    try {
      const storagePath = await uploadAudioForJobDirect(jobId, file);
      onUploaded(storagePath);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Network error during upload",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    const validationError = await validateAudioFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploading(true);
    try {
      const storagePath = await uploadAudioForJobDirect(jobId, file);
      onUploaded(storagePath);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Network error during upload",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="mt-3 p-3"
      data-testid="audio-upload-panel"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        void handleDrop(e);
      }}
      style={{
        border: dragOver ? "2px solid #3B276A" : "1px dashed #746EB1",
        borderRadius: "2px",
        backgroundColor: "#F9F9FF",
      }}
    >
      <label
        htmlFor={`audio-upload-${jobId}`}
        className="flex cursor-pointer items-center justify-center gap-2 text-sm font-medium"
        style={{
          color: uploading ? "#777777" : "#517AB7",
          cursor: uploading ? "not-allowed" : "pointer",
        }}
      >
        {uploading ? (
          <>
            <span
              className="h-3.5 w-3.5 rounded-full border-2 animate-spin"
              style={{ borderColor: "#746EB1", borderTopColor: "transparent" }}
            />
            Uploading {fileName}...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <span style={{ color: "#999999", fontWeight: 400 }}>Drag & drop or </span>Upload audio file
          </>
        )}
      </label>

      <input
        ref={inputRef}
        id={`audio-upload-${jobId}`}
        type="file"
        accept={ACCEPTED_TYPES}
        disabled={uploading}
        onChange={(event) => {
          void handleFileChange(event);
        }}
        className="sr-only"
        data-testid="audio-file-input"
      />

      {error && (
        <p className="mt-2 text-xs font-medium" style={{ color: "#CC2200" }} role="alert">
          {error}
        </p>
      )}
      {!error && (
        <p className="mt-2 text-xs" style={{ color: "#777777" }}>
          Supported formats: WebM, MP3, MP4, M4A, OGG, WAV.
        </p>
      )}
    </div>
  );
}
