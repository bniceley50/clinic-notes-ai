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
  queued: "ql-chip is-running",
  running: "ql-chip is-running",
  complete: "ql-chip is-complete",
  failed: "ql-chip is-error",
  cancelled: "ql-chip",
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
      <p className="ql-subtitle">
        No jobs yet. Start one above.
      </p>
    );
  }

  return (
    <div className="ql-grid">
      {state.jobs.map((job) => (
        <div key={job.id} className="ql-panel">
          <div className="ql-copy-row">
            <span className="ql-section-title" style={{ margin: 0 }}>
              {job.note_type}
            </span>
            <span
              className={JOB_STATUS_STYLE[job.status] ?? "ql-chip"}
            >
              {job.status}
            </span>
          </div>

          {ACTIVE_STATUSES.has(job.status) && (
            <div style={{ marginTop: 10 }}>
              <div
                className="ql-copy-row"
                style={{ color: "var(--ql-text-muted)", fontSize: 11, marginBottom: 4 }}
              >
                <span>{job.stage}</span>
                <span>{job.progress}%</span>
              </div>
              <div
                style={{
                  height: 6,
                  width: "100%",
                  border: "1px solid var(--ql-border)",
                  borderRadius: "2px",
                  background: "#f9f9f9",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: "var(--ql-primary-soft)",
                    width: `${job.progress}%`,
                  }}
                />
              </div>
            </div>
          )}

          {!ACTIVE_STATUSES.has(job.status) && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                color: "var(--ql-text-muted)",
                fontSize: 11,
              }}
            >
              <span>Stage: {job.stage}</span>
              <span>Progress: {job.progress}%</span>
              {job.attempt_count > 0 && (
                <span>Attempts: {job.attempt_count}</span>
              )}
            </div>
          )}

          {job.error_message && (
            <p className="ql-alert ql-alert-error" style={{ marginTop: 8 }}>
              {job.error_message}
            </p>
          )}

          <div className="ql-copy-row" style={{ marginTop: 8 }}>
            <p className="ql-subtitle">{new Date(job.created_at).toLocaleString()}</p>
            {ACTIVE_STATUSES.has(job.status) && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--ql-link)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 6,
                    background: "var(--ql-link)",
                  }}
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
