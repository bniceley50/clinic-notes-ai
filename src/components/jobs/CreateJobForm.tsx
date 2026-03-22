"use client";

import React, { useState } from "react";
import {
  deriveConsentStatus,
  deriveDeclinedConsentStatus,
  isConsentDeclined,
  shouldAllowJobStart,
  shouldShowConsentPrompt,
  type ConsentStatus,
} from "@/lib/models/consent";
import { AudioUpload } from "./AudioUpload";
import { AudioRecorder } from "./AudioRecorder";
import { ConsentGate } from "./ConsentGate";
import type { JobSnapshot } from "./JobStatusPanel";

type Props = {
  sessionId: string;
  hasActiveJob: boolean;
  consentStatus: ConsentStatus;
  mode?: "job" | "advanced";
  transcript?: string | null;
  noteGenerated?: boolean;
  onJobStarted?: (job: JobSnapshot) => void;
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
  job: JobSnapshot;
};

type CreateJobError = {
  error?: string;
};

type GenerateNoteSuccess = {
  note_id: string;
};

type TriggerJobSuccess = {
  job_id: string;
  status: string;
};

type TriggerJobError = {
  error?: string;
};

export function CreateJobForm({
  sessionId,
  hasActiveJob,
  consentStatus,
  mode = "job",
  transcript = null,
  noteGenerated = false,
  onJobStarted,
}: Props) {
  const [noteType, setNoteType] = useState<NoteType>("soap");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [triggerPending, setTriggerPending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<JobSnapshot | null>(null);
  const [audioUploaded, setAudioUploaded] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [audioMode, setAudioMode] = useState<"record" | "upload">("record");
  const [localConsentStatus, setLocalConsentStatus] =
    useState<ConsentStatus>(consentStatus);
  const canStartJob = shouldAllowJobStart(localConsentStatus);
  const canGenerateNote =
    shouldAllowJobStart(localConsentStatus) && !!transcript;

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
      setCreatedJob(payload.job);
      setAudioUploaded(false);
      setUploadComplete(false);
      setTriggerError(null);
    } catch {
      setError("Failed to create job");
    } finally {
      setPending(false);
    }
  }

  async function startProcessing(audioJobId: string, audioStoragePath?: string) {
    setTriggerPending(true);
    setTriggerError(null);

    try {
      const response = await fetch(`/api/jobs/${audioJobId}/trigger`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | TriggerJobSuccess
        | TriggerJobError
        | null;

      if (!response.ok) {
        throw new Error(
          (payload && "error" in payload && payload.error) ||
            "Failed to start processing",
        );
      }

      setAudioUploaded(true);
      setUploadComplete(false);
      onJobStarted?.({
        ...(createdJob ?? {
          id: audioJobId,
          session_id: sessionId,
          status: "queued",
          stage: "queued",
          progress: 0,
          note_type: noteType,
          attempt_count: 0,
          error_message: null,
          audio_storage_path: null,
          transcript_storage_path: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        audio_storage_path:
          audioStoragePath ?? createdJob?.audio_storage_path ?? null,
      });
    } catch (triggerError) {
      setAudioUploaded(false);
      setUploadComplete(true);
      setTriggerError(
        triggerError instanceof Error
          ? triggerError.message
          : "Failed to start processing",
      );
    } finally {
      setTriggerPending(false);
    }
  }

  function handleAudioUploaded(audioStoragePath?: string) {
    if (!jobId) {
      setTriggerError("Failed to start processing");
      return;
    }

    setError(null);
    setUploadComplete(true);
    void startProcessing(jobId, audioStoragePath);
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
          note_type: noteType.toUpperCase(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | GenerateNoteSuccess
        | CreateJobError
        | null;

      if (!response.ok || !payload || !("note_id" in payload)) {
        const detail =
          payload && "detail" in payload && typeof payload.detail === "string"
            ? payload.detail
            : null;
        setError(
          detail ||
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

          {!shouldAllowJobStart(localConsentStatus) && (
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
          {shouldShowConsentPrompt(localConsentStatus) && (
            <ConsentGate
              sessionId={sessionId}
              consentStatus={localConsentStatus}
              onConfirmed={() => {
                setLocalConsentStatus(
                  deriveConsentStatus({
                    hipaa_consent: true,
                    part2_applicable: false,
                    part2_consent: null,
                    created_at: new Date().toISOString(),
                  }),
                );
                setError(null);
              }}
              onDeclined={() => {
                setLocalConsentStatus(deriveDeclinedConsentStatus());
              }}
            />
          )}

          {isConsentDeclined(localConsentStatus) && (
            <p className="mt-3 text-xs font-medium" style={{ color: "#CC2200" }}>
              Recording is blocked because the patient did not consent.
            </p>
          )}

          {shouldAllowJobStart(localConsentStatus) && (
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
                  onUploaded={(storagePath) => {
                    handleAudioUploaded(storagePath);
                  }}
                />
              ) : (
                <AudioUpload
                  jobId={jobId}
                  onUploaded={(storagePath) => {
                    handleAudioUploaded(storagePath);
                  }}
                />
              )}

              {triggerPending && uploadComplete && (
                <p className="mt-3 text-sm font-medium" style={{ color: "#746EB1" }}>
                  Audio uploaded - starting transcription...
                </p>
              )}

              {triggerError && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium" style={{ color: "#CC2200" }} role="alert">
                    {triggerError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (jobId) {
                        void startProcessing(jobId);
                      }
                    }}
                    disabled={triggerPending}
                    className="text-xs font-medium underline"
                    style={{ color: "#517AB7" }}
                  >
                    Try again
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {audioUploaded && (
        <p className="mt-3 text-sm font-medium" style={{ color: "#2F6F44" }}>
          Audio uploaded - transcription started
        </p>
      )}
    </div>
  );
}
