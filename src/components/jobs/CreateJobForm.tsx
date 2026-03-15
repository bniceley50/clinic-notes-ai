"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioUpload } from "./AudioUpload";
import { AudioRecorder } from "./AudioRecorder";
import { ConsentGate } from "./ConsentGate";

type Props = {
  sessionId: string;
  hasActiveJob: boolean;
  hasConsent: boolean;
  mode?: "job" | "advanced";
  transcript?: string | null;
  orgId?: string;
  noteGenerated?: boolean;
};

const NOTE_TYPES = ["soap", "dap", "birp", "girp"] as const;

type NoteType = (typeof NOTE_TYPES)[number];

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  soap: "SOAP",
  dap: "DAP",
  birp: "BIRP",
  girp: "GIRP",
};

type CreateJobSuccess = {
  job: {
    id: string;
  };
};

type CreateJobError = {
  error?: string;
};

type GenerateNoteSuccess = {
  note_id: string;
};

export function CreateJobForm({
  sessionId,
  hasActiveJob,
  hasConsent,
  mode = "job",
  transcript = null,
  orgId,
  noteGenerated = false,
}: Props) {
  const [noteType, setNoteType] = useState<NoteType>("soap");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [audioUploaded, setAudioUploaded] = useState(false);
  const [audioMode, setAudioMode] = useState<"record" | "upload">("record");
  const [consentState, setConsentState] = useState<
    "unknown" | "confirmed" | "declined"
  >(hasConsent ? "confirmed" : "unknown");
  const [processingStatus, setProcessingStatus] = useState<
    "idle" | "transcribing" | "complete"
  >("idle");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canStartJob = hasConsent === true;
  const canGenerateNote = hasConsent && !!transcript && !!orgId;

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => clearPolling, [clearPolling]);

  const beginPolling = useCallback(
    (activeJobId: string) => {
      clearPolling();
      setProcessingStatus("transcribing");

      async function refreshJob() {
        try {
          const response = await fetch(`/api/jobs/${activeJobId}`);
          const payload = (await response.json().catch(() => null)) as
            | { status?: string; error_message?: string | null }
            | null;

          if (!response.ok) {
            throw new Error(payload?.error_message ?? "Unable to refresh job status");
          }

          if (payload?.status === "complete") {
            clearPolling();
            setProcessingStatus("complete");
            window.setTimeout(() => {
              window.location.reload();
            }, 900);
            return;
          }

          if (payload?.status === "failed" || payload?.status === "cancelled") {
            clearPolling();
            setProcessingStatus("idle");
            setError(
              payload.error_message ??
                `Transcription ${payload.status}. Reload the page to continue.`,
            );
          }
        } catch (refreshError) {
          clearPolling();
          setProcessingStatus("idle");
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "Unable to refresh transcription status. Reload the page to continue.",
          );
        }
      }

      void refreshJob();
      pollingRef.current = setInterval(() => {
        void refreshJob();
      }, 3_000);
    },
    [clearPolling],
  );

  const handleAudioUploaded = useCallback(
    async (storagePath: string) => {
      if (!jobId) {
        throw new Error("Job was created but could not be found for processing.");
      }

      void storagePath;
      setAudioUploaded(true);
      setError(null);

      const response = await fetch(`/api/jobs/${jobId}/trigger`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setAudioUploaded(false);
        throw new Error(payload?.error ?? "Failed to start transcription");
      }

      beginPolling(jobId);
    },
    [beginPolling, jobId],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (hasActiveJob || pending || jobId || !canStartJob) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          note_type: noteType,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | CreateJobSuccess
        | CreateJobError
        | null;

      if (!response.ok || !payload || !("job" in payload) || !payload.job?.id) {
        setError(
          (payload && "error" in payload && payload.error) ||
            "Failed to create job",
        );
        return;
      }

      setJobId(payload.job.id);
      setAudioUploaded(false);
      setProcessingStatus("idle");
      setConsentState(hasConsent ? "confirmed" : "unknown");
    } catch {
      setError("Failed to create job");
    } finally {
      setPending(false);
    }
  }

  async function handleGenerateNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending || !canGenerateNote) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          transcript,
          note_type: noteType.toUpperCase(),
          org_id: orgId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | GenerateNoteSuccess
        | CreateJobError
        | null;

      if (!response.ok || !payload || !("note_id" in payload)) {
        setError(
          (payload && "error" in payload && payload.error) ||
            "Failed to generate note",
        );
        return;
      }

      window.location.reload();
    } catch {
      setError("Failed to generate note");
    } finally {
      setPending(false);
    }
  }

  if (mode === "advanced") {
    return (
      <div className="space-y-3">
        <p className="text-xs" style={{ color: "#555555" }}>
          Generate an optional SOAP-style note from the completed transcript.
          This is an advanced workflow and is not required for EHR field extraction.
        </p>

        <form onSubmit={(event) => void handleGenerateNote(event)} className="space-y-3">
          <div>
            <label
              htmlFor="advanced_note_type"
              className="mb-1 block text-xs font-semibold"
              style={{ color: "#517AB7", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Note Type
            </label>
            <select
              id="advanced_note_type"
              name="advanced_note_type"
              data-testid="advanced-note-type"
              value={noteType}
              onChange={(event) => setNoteType(event.target.value as NoteType)}
              disabled={pending || !canGenerateNote}
              className="input-ql disabled:opacity-50"
              style={{ minWidth: "160px" }}
            >
              {NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {NOTE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={pending || !canGenerateNote}
            className="btn-ql"
            data-testid="generate-note-button"
          >
            {pending ? "Generating..." : noteGenerated ? "Generate New Note" : "Generate Note"}
          </button>

          {!hasConsent && (
            <p className="text-xs font-medium" style={{ color: "#8A4B08" }}>
              Patient consent must be recorded before optional note generation is available.
            </p>
          )}

          {!transcript && (
            <p className="text-xs font-medium" style={{ color: "#8A4B08" }}>
              A completed transcript is required before generating an optional note.
            </p>
          )}

          {error && (
            <p className="text-sm font-medium" style={{ color: "#CC2200" }} role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="card-ql p-4">
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex items-center gap-4">
          {canStartJob ? (
            <div className="flex items-end">
              <button
                type="submit"
                disabled={hasActiveJob || pending || !!jobId}
                className="btn-ql"
              >
                {pending ? "Creating..." : "Start Job"}
              </button>
            </div>
          ) : null}
        </div>

        {!canStartJob && !error && !jobId && (
          <p className="mt-2 text-xs font-medium" style={{ color: "#8A4B08" }}>
            Patient consent must be recorded before AI-assisted documentation can begin.
          </p>
        )}

        {hasActiveJob && !error && !jobId && (
          <p className="mt-2 text-xs font-medium" style={{ color: "#746EB1" }}>
            This session already has an active job running.
          </p>
        )}

        {error && (
          <p className="mt-2 text-sm font-medium" style={{ color: "#CC2200" }} role="alert">
            {error}
          </p>
        )}
      </form>

      {jobId && !audioUploaded && (
        <>
          {consentState === "unknown" && (
            <ConsentGate
              sessionId={sessionId}
              onConfirmed={() => {
                setConsentState("confirmed");
                setError(null);
              }}
              onDeclined={() => {
                setConsentState("declined");
              }}
            />
          )}

          {consentState === "declined" && (
            <p className="mt-3 text-xs font-medium" style={{ color: "#CC2200" }}>
              Recording is blocked because the patient did not consent.
            </p>
          )}

          {consentState === "confirmed" && (
            <>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAudioMode("record")}
                  className="rounded px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: audioMode === "record" ? "#3B276A" : "#E7E9EC",
                    color: audioMode === "record" ? "#FFFFFF" : "#517AB7",
                  }}
                >
                  Record
                </button>
                <button
                  type="button"
                  onClick={() => setAudioMode("upload")}
                  className="rounded px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: audioMode === "upload" ? "#3B276A" : "#E7E9EC",
                    color: audioMode === "upload" ? "#FFFFFF" : "#517AB7",
                  }}
                >
                  Upload file
                </button>
              </div>

              {audioMode === "record" ? (
                <AudioRecorder
                  jobId={jobId}
                  onUploaded={handleAudioUploaded}
                />
              ) : (
                <AudioUpload
                  jobId={jobId}
                  onUploaded={handleAudioUploaded}
                />
              )}
            </>
          )}
        </>
      )}

      {audioUploaded && processingStatus !== "idle" && (
        <p
          className="mt-3 text-sm font-medium"
          style={{ color: processingStatus === "complete" ? "#2F6F44" : "#517AB7" }}
        >
          {processingStatus === "complete" ? "Complete" : "Transcribing..."}
        </p>
      )}
    </div>
  );
}
