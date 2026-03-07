"use client";

import { useEffect, useCallback, useReducer } from "react";
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
  created_at: string;
  updated_at: string;
};

/* CareLogic-aligned status chip classes (defined in globals.css) */
const JOB_STATUS_CHIP: Record<string, string> = {
  queued:    "chip-queued",
  running:   "chip-running",
  complete:  "chip-complete",
  failed:    "chip-failed",
  cancelled: "chip-cancelled",
};

/* Progress bar colors per status */
const PROGRESS_BAR_COLOR: Record<string, string> = {
  queued:  "#746EB1",
  running: "#3B276A",
  complete:"#2E7D32",
  failed:  "#CC2200",
};

const POLL_INTERVAL_MS = 3_000;
const ACTIVE_STATUSES = new Set(["queued", "running"]);

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
        if (ACTIVE_STATUSES.has(j.status)) polling.add(j.id);
      }
      return { jobs: action.jobs, polling };
    }
    case "update": {
      const jobs = state.jobs.map((j) =>
        j.id === action.job.id ? action.job : j,
      );
      const polling = new Set(state.polling);
      if (!ACTIVE_STATUSES.has(action.job.status)) {
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
      if (ACTIVE_STATUSES.has(j.status)) polling.add(j.id);
    }
    return { jobs, polling };
  });

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        dispatch({ type: "stop_polling", id: jobId });
        return;
      }
      const job: JobSnapshot = await res.json();
      dispatch({ type: "update", job });
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

          {/* Header row: note type + status chip */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#3B276A" }}>
              {job.note_type}
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

          {/* Progress bar (active only) */}
          {ACTIVE_STATUSES.has(job.status) && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#777777" }}>
                <span className="uppercase tracking-wide">{job.stage}</span>
                <span data-testid="job-progress">{job.progress}%</span>
              </div>
              <div
                className="h-1.5 w-full rounded-[2px]"
                style={{ backgroundColor: "#E7E9EC" }}
              >
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

          {/* Completed meta */}
          {!ACTIVE_STATUSES.has(job.status) && (
            <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: "#777777" }}>
              <span>Stage: <span className="font-medium">{job.stage}</span></span>
              <span>Progress: <span className="font-medium" data-testid="job-progress">{job.progress}%</span></span>
              {job.attempt_count > 1 && (
                <span>Attempts: <span className="font-medium">{job.attempt_count}</span></span>
              )}
            </div>
          )}

          {/* Audio upload prompt */}
          {job.status === "queued" && !job.audio_storage_path && (
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

          {/* Audio confirmed */}
          {job.audio_storage_path && (
            <p className="mt-2 text-xs font-medium" style={{ color: "#2E7D32" }}>
              ✓ Audio uploaded
            </p>
          )}

          {/* Error message */}
          {job.error_message && (
            <p className="mt-2 text-xs font-medium" style={{ color: "#CC2200" }}>
              {job.error_message}
            </p>
          )}

          {/* Footer: timestamp + live indicator */}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px]" style={{ color: "#777777" }}>
              {new Date(job.created_at).toLocaleString()}
            </p>
            {ACTIVE_STATUSES.has(job.status) && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#746EB1" }}>
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: "#746EB1" }}
                />
                Live
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
