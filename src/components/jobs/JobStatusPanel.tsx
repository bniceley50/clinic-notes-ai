"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  didJobReachComplete,
  deriveJobState,
  getJobTitle,
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
  queued: "#746EB1",
  running: "#3B276A",
  complete: "#2E7D32",
  failed: "#CC2200",
};

const POLL_INTERVAL_MS = 10_000;
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
};

export function JobStatusPanel({ initialJobs }: Props) {
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
        window.location.reload();
      }
    } catch {
      dispatch({ type: "stop_polling", id: jobId });
    }
  }, []);

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
      await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
    } finally {
      window.location.reload();
    }
  }

  if (state.jobs.length === 0) {
    return (
      <p
        className="mt-6 text-center text-sm"
        style={{ color: "#777777" }}
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
            return (
              <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#3B276A" }}>
              {getJobTitle(jobState)}
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

          <p className="mt-1 text-xs" style={{ color: "#777777" }}>
            Created {new Date(job.created_at).toLocaleDateString()} · Optional note format:{" "}
            <span className="font-medium">{formatNoteType(job.note_type)}</span>
          </p>

          {shouldShowJobProgress(jobState) && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs" style={{ color: "#777777" }}>
                <span className="uppercase tracking-wide">{jobState.stage}</span>
                <span data-testid="job-progress">{job.progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-[2px]" style={{ backgroundColor: "#E7E9EC" }}>
                <div
                  className="h-1.5 rounded-[2px] transition-all duration-500"
                  style={{
                    width: `${job.progress}%`,
                    backgroundColor: PROGRESS_BAR_COLOR[job.status] ?? "#3B276A",
                  }}
                />
              </div>
            </div>
          )}

          {!shouldShowJobProgress(jobState) && (
            <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: "#777777" }}>
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
            <p className="mt-2 text-xs font-medium" style={{ color: "#2E7D32" }}>
              &#10003; Audio uploaded
            </p>
          )}

          {shouldShowJobProgress(jobState) && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void handleCancel(job.id)}
                disabled={cancelingJobId === job.id}
                className="rounded px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: cancelingJobId === job.id ? "#F4CCCC" : "#FCE8E6",
                  color: "#B42318",
                }}
              >
                {cancelingJobId === job.id ? "Cancelling..." : "Cancel Job"}
              </button>
            </div>
          )}

          {job.error_message && (
            <p className="mt-2 text-xs font-medium" style={{ color: "#CC2200" }}>
              {job.error_message}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px]" suppressHydrationWarning style={{ color: "#777777" }}>
              {new Date(job.created_at).toLocaleString()}
            </p>
            {shouldShowJobProgress(jobState) && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#746EB1" }}>
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ backgroundColor: "#746EB1" }}
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
