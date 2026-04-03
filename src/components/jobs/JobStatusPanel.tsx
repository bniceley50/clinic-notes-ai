"use client";

import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  didJobReachComplete,
  deriveJobState,
  getJobTitle,
  isRetrying,
  isJobActive,
  shouldAllowAudioUpload,
  shouldShowJobProgress,
  type JobState,
} from "@/lib/models/job-lifecycle";
import { AudioUpload } from "./AudioUpload";

export type JobSnapshot = {
  id: string;
  session_id: string;
  status: string;
  stage: string;
  progress: number;
  note_type: string;
  attempt_count: number;
  error_message: string | null;
  audio_storage_path: string | null;
  transcript_storage_path: string | null;
  created_at: string;
  updated_at: string;
};

const JOB_STATUS_CHIP: Record<string, string> = {
  queued: "chip-queued",
  running: "chip-running",
  complete: "chip-complete",
  failed: "chip-failed",
  cancelled: "chip-cancelled",
};

const PROGRESS_BAR_COLOR: Record<string, string> = {
  queued: "[&::-moz-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-secondary",
  running: "[&::-moz-progress-bar]:bg-primary [&::-webkit-progress-value]:bg-primary",
  complete: "[&::-moz-progress-bar]:bg-[#2E7D32] [&::-webkit-progress-value]:bg-[#2E7D32]",
  failed: "[&::-moz-progress-bar]:bg-alert [&::-webkit-progress-value]:bg-alert",
};

const POLL_INTERVAL_MS = 10_000;
const MAX_TRANSCRIPTION_ATTEMPTS = 3;
function formatNoteType(noteType: string): string {
  return noteType.toUpperCase();
}

type State = {
  jobs: JobSnapshot[];
  polling: Set<string>;
};

type Action =
  | { type: "init"; jobs: JobSnapshot[] }
  | { type: "update"; job: JobSnapshot }
  | { type: "stop_polling"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init": {
      const polling = new Set<string>();
      for (const j of action.jobs) {
        if (isJobActive(deriveJobState(j))) polling.add(j.id);
      }
      return { jobs: action.jobs, polling };
    }
    case "update": {
      const jobs = state.jobs.map((j) =>
        j.id === action.job.id ? action.job : j,
      );
      const polling = new Set(state.polling);
      if (!isJobActive(deriveJobState(action.job))) {
        polling.delete(action.job.id);
      }
      return { jobs, polling };
    }
    case "stop_polling": {
      const polling = new Set(state.polling);
      polling.delete(action.id);
      return { ...state, polling };
    }
  }
}

type Props = {
  initialJobs: JobSnapshot[];
  onJobComplete?: () => void;
  onJobCancelled?: () => void;
};

export function JobStatusPanel({
  initialJobs,
  onJobComplete,
  onJobCancelled,
}: Props) {
  const [state, dispatch] = useReducer(reducer, initialJobs, (jobs) => {
    const polling = new Set<string>();
    for (const j of jobs) {
      if (isJobActive(deriveJobState(j))) polling.add(j.id);
    }
    return { jobs, polling };
  });
  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const lastKnownStateRef = useRef<Record<string, JobState>>(
    Object.fromEntries(initialJobs.map((job) => [job.id, deriveJobState(job)])),
  );

  useEffect(() => {
    dispatch({ type: "init", jobs: initialJobs });
    lastKnownStateRef.current = Object.fromEntries(
      initialJobs.map((job) => [job.id, deriveJobState(job)]),
    );
  }, [initialJobs]);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        dispatch({ type: "stop_polling", id: jobId });
        return;
      }
      const job: JobSnapshot = await res.json();
      const previousState = lastKnownStateRef.current[job.id] ?? null;
      const nextState = deriveJobState(job);
      lastKnownStateRef.current[job.id] = nextState;
      dispatch({ type: "update", job });

      if (didJobReachComplete(previousState, nextState)) {
        onJobComplete?.();
      }
    } catch {
      dispatch({ type: "stop_polling", id: jobId });
    }
  }, [onJobComplete]);

  useEffect(() => {
    if (state.polling.size === 0) return;
    const interval = setInterval(() => {
      for (const jobId of state.polling) {
        pollJob(jobId);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state.polling, pollJob]);

  async function handleCancel(jobId: string) {
    setCancelingJobId(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
      if (response.ok) {
        onJobCancelled?.();
      }
    } finally {
      setCancelingJobId(null);
    }
  }

  if (state.jobs.length === 0) {
    return (
      <p
        className="mt-6 text-center text-sm text-text-muted"
        data-testid="job-status-panel"
      >
        No jobs yet. Start one above.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3" data-testid="job-status-panel">
      {state.jobs.map((job) => (
        <div key={job.id} className="card-ql p-4">
          {(() => {
             const jobState = deriveJobState(job);
             const retrying = isRetrying(job);
             const exhaustedRetries =
               job.status === "failed" && job.attempt_count >= MAX_TRANSCRIPTION_ATTEMPTS;
             return (
               <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wide text-primary">
              {getJobTitle(jobState, job.attempt_count)}
            </span>
            <span
              className={`inline-block rounded-[2px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                JOB_STATUS_CHIP[job.status] ?? "chip-cancelled"
              }`}
              data-testid="job-status-chip"
            >
              {job.status}
            </span>
          </div>

          <p className="mt-1 text-xs text-text-muted">
            Created {new Date(job.created_at).toLocaleDateString()} · Optional note format:{" "}
            <span className="font-medium">{formatNoteType(job.note_type)}</span>
          </p>

          {shouldShowJobProgress(jobState) && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-3">
                  <span className="uppercase tracking-wide">{jobState.stage}</span>
                  {job.attempt_count > 1 && (
                    <span className="font-medium text-primary">
                      {retrying
                        ? `Retry ${job.attempt_count} of ${MAX_TRANSCRIPTION_ATTEMPTS}`
                        : `Attempt ${job.attempt_count} of ${MAX_TRANSCRIPTION_ATTEMPTS}`}
                    </span>
                  )}
                </div>
                <span data-testid="job-progress">{job.progress}%</span>
              </div>
              <progress
                className={`h-1.5 w-full overflow-hidden rounded-[2px] [&::-webkit-progress-bar]:bg-border-subtle [&::-webkit-progress-value]:rounded-[2px] ${PROGRESS_BAR_COLOR[job.status] ?? PROGRESS_BAR_COLOR.running}`}
                value={job.progress}
                max={100}
              />
            </div>
          )}

          {!shouldShowJobProgress(jobState) && (
            <div className="mt-2 flex items-center gap-4 text-xs text-text-muted">
              <span>
                Stage: <span className="font-medium">{jobState.stage}</span>
              </span>
              <span>
                Progress: <span className="font-medium" data-testid="job-progress">{job.progress}%</span>
              </span>
              {job.attempt_count > 1 && (
                <span>
                  Attempts: <span className="font-medium">{job.attempt_count}</span>
                </span>
              )}
              {job.attempt_count > 1 && !jobState.isFailed && (
                <span>
                  <span className="font-medium">
                    Attempt {job.attempt_count} of {MAX_TRANSCRIPTION_ATTEMPTS}
                  </span>
                </span>
              )}
            </div>
          )}

          {shouldAllowAudioUpload(jobState) && (
            <AudioUpload
              jobId={job.id}
              onUploaded={(path) =>
                dispatch({
                  type: "update",
                  job: { ...job, audio_storage_path: path },
                })
              }
            />
          )}

          {job.audio_storage_path && (
            <p className="mt-2 text-xs font-medium text-success">
              &#10003; Audio uploaded
            </p>
          )}

          {shouldShowJobProgress(jobState) && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void handleCancel(job.id)}
                disabled={cancelingJobId === job.id}
                className={`rounded px-3 py-1 text-xs font-semibold text-[#B42318] ${cancelingJobId === job.id ? "bg-[#F4CCCC]" : "bg-[#FCE8E6]"}`}
              >
                {cancelingJobId === job.id ? "Cancelling..." : "Cancel Job"}
              </button>
            </div>
          )}

          {job.error_message && (
            <p className="mt-2 text-xs font-medium text-alert">
              {job.error_message}
            </p>
          )}

          {exhaustedRetries && (
            <div className="mt-3 rounded-[2px] border border-[#F4CCCC] bg-[#FFF4F2] px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#B42318]">
                What to do next
              </p>
              <p className="mt-1 text-xs text-text-muted">
                The transcription could not be completed after 3 attempts. Please try uploading the audio again or contact support if the problem continues.
              </p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-text-muted" suppressHydrationWarning>
              {new Date(job.created_at).toLocaleString()}
            </p>
            {shouldShowJobProgress(jobState) && (
              <span className="inline-flex items-center gap-1 text-xs text-secondary">
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary"
                />
                Live
              </span>
            )}
          </div>
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}
