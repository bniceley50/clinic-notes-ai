"use client";

import { useState } from "react";
import { AudioUpload } from "./AudioUpload";
import { AudioRecorder } from "./AudioRecorder";
import { ConsentGate } from "./ConsentGate";

type Props = {
  sessionId: string;
  hasActiveJob: boolean;
  hasConsent: boolean;
};

const NOTE_TYPES = [
  "soap",
  "dap",
  "birp",
  "girp",
  "intake",
  "progress",
] as const;

type NoteType = (typeof NOTE_TYPES)[number];

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  soap: "SOAP",
  dap: "DAP",
  birp: "BIRP",
  girp: "GIRP",
  intake: "Intake",
  progress: "Progress",
};

type CreateJobSuccess = {
  job: {
    id: string;
  };
};

type CreateJobError = {
  error?: string;
};

export function CreateJobForm({ sessionId, hasActiveJob, hasConsent }: Props) {
  const [noteType, setNoteType] = useState<NoteType>("soap");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [audioUploaded, setAudioUploaded] = useState(false);
  const [audioMode, setAudioMode] = useState<"record" | "upload">("record");
  const [consentState, setConsentState] = useState<
    "unknown" | "confirmed" | "declined"
  >("unknown");
  const canStartJob = hasConsent === true;

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
    } catch {
      setError("Failed to create job");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card-ql p-4">
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label
              htmlFor="note_type"
              className="mb-1 block text-xs font-semibold"
              style={{ color: "#517AB7", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Note Type
            </label>
            <select
              id="note_type"
              name="note_type"
              data-testid="job-note-type"
              value={noteType}
              onChange={(event) => setNoteType(event.target.value as NoteType)}
              disabled={hasActiveJob || pending || !!jobId || !canStartJob}
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
            Patient consent must be recorded before a job can be started.
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
                  onUploaded={() => {
                    setAudioUploaded(true);
                    setError(null);
                    fetch(`/api/jobs/${jobId}/trigger`, { method: "POST" })
                      .catch(() => {
                        /* trigger failed silently */
                      })
                      .finally(() => {
                        window.location.reload();
                      });
                  }}
                />
              ) : (
                <AudioUpload
                  jobId={jobId}
                  onUploaded={() => {
                    setAudioUploaded(true);
                    setError(null);
                    fetch(`/api/jobs/${jobId}/trigger`, { method: "POST" })
                      .catch(() => {
                        /* trigger failed silently */
                      })
                      .finally(() => {
                        window.location.reload();
                      });
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {audioUploaded && (
        <p className="mt-3 text-sm font-medium" style={{ color: "#2F6F44" }}>
          Audio uploaded - processing will begin shortly
        </p>
      )}
    </div>
  );
}