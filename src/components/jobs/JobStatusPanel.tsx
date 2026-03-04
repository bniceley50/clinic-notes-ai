"use client";

import { useEffect, useCallback, useReducer } from "react";

export type JobSnapshot = {
  id: string;
  session_id: string;
  status: string;
  stage: string;
  progress: number;
  note_type: string;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const JOB_STATUS_STYLE: Record<string, string> = {
  queued: "bg-yellow-50 text-yellow-700",
  running: "bg-blue-50 text-blue-700",
  complete: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
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
      <p className="mt-6 text-center text-sm text-gray-500">
        No jobs yet. Start one above.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {state.jobs.map((job) => (
        <div key={job.id} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 uppercase">
              {job.note_type}
            </span>
            <span
              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                JOB_STATUS_STYLE[job.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {job.status}
            </span>
          </div>

          {ACTIVE_STATUSES.has(job.status) && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{job.stage}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          {!ACTIVE_STATUSES.has(job.status) && (
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span>Stage: {job.stage}</span>
              <span>Progress: {job.progress}%</span>
              {job.attempt_count > 0 && (
                <span>Attempts: {job.attempt_count}</span>
              )}
            </div>
          )}

          {job.error_message && (
            <p className="mt-2 text-xs text-red-600">{job.error_message}</p>
          )}

          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {new Date(job.created_at).toLocaleString()}
            </p>
            {ACTIVE_STATUSES.has(job.status) && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
