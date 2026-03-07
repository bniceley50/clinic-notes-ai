"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const NOTE_TYPE_OPTIONS = [
  { value: "soap", label: "SOAP" },
  { value: "dap", label: "DAP" },
  { value: "birp", label: "BIRP" },
] as const;

type Props = {
  sessionId: string;
  hasActiveJob: boolean;
};

export function AudioUpload({ sessionId, hasActiveJob }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    try {
      const noteType =
        typeof formData.get("note_type") === "string"
          ? String(formData.get("note_type"))
          : "soap";
      const file = formData.get("file");

      if (!(file instanceof File) || file.size === 0) {
        setError("Select an audio file before queuing the upload.");
        return;
      }

      const createResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          note_type: noteType,
        }),
      });

      const createPayload = (await createResponse.json().catch(() => null)) as
        | { error?: string; job?: { id: string } }
        | null;

      if (!createResponse.ok || !createPayload?.job?.id) {
        setError(createPayload?.error ?? "Failed to create job");
        return;
      }

      const uploadFormData = new FormData();
      uploadFormData.set("file", file);

      const uploadResponse = await fetch(
        `/api/jobs/${createPayload.job.id}/upload`,
        {
          method: "POST",
          body: uploadFormData,
        },
      );

      const uploadPayload = (await uploadResponse.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!uploadResponse.ok) {
        setError(uploadPayload?.error ?? "Failed to upload audio");
        return;
      }

      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ql-panel" data-testid="audio-upload-panel">
      <p className="ql-kicker">Audio Intake</p>
      <h2 className="ql-panel-title">Upload Recording</h2>
      <div className="ql-alert">
        Uploading audio creates a queued job for this session and stores the file
        in Supabase Storage for the next pipeline step.
      </div>

      {error ? (
        <p
          className="ql-alert ql-alert-error"
          role="alert"
          style={{ marginTop: 8 }}
        >
          {error}
        </p>
      ) : null}

      {hasActiveJob ? (
        <p className="ql-alert ql-alert-warning" style={{ marginTop: 8 }}>
          This session already has an active job. Cancel it before queuing another.
        </p>
      ) : null}

      <form action={handleSubmit} className="ql-filter-row" style={{ marginTop: 12 }}>
        <div className="ql-field" style={{ width: 160 }}>
          <label className="ql-label" htmlFor="note_type">
            Note Type
          </label>
          <select
            id="note_type"
            name="note_type"
            defaultValue="soap"
            disabled={hasActiveJob || pending}
            className="ql-select"
            data-testid="job-note-type"
          >
            {NOTE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ql-field" style={{ minWidth: 240, flex: "1 1 240px" }}>
          <label className="ql-label" htmlFor="audio-file">
            Recording File
          </label>
          <input
            id="audio-file"
            name="file"
            type="file"
            accept="audio/*,.webm"
            disabled={hasActiveJob || pending}
            className="ql-input"
            data-testid="audio-file-input"
          />
        </div>
        <button
          type="submit"
          disabled={hasActiveJob || pending}
          className="ql-button"
          style={{ marginTop: 17 }}
          data-testid="queue-upload-button"
        >
          {pending ? "Uploading..." : "Queue Upload"}
        </button>
      </form>
    </section>
  );
}
