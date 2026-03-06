"use client";

import { useState } from "react";

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

const JOB_STATUS_STYLE: Record<string, string> = {
  queued: "ql-chip is-running",
  running: "ql-chip is-running",
  complete: "ql-chip is-complete",
  failed: "ql-chip is-error",
  cancelled: "ql-chip",
};

const ACTIVE_STATUSES = new Set(["queued", "running"]);

type Props = {
  initialJobs: JobSnapshot[];
};

export function JobStatusPanel({ initialJobs }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(jobId: string) {
    setPendingJobId(jobId);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; job?: JobSnapshot }
        | null;

      if (!response.ok || !payload?.job) {
        setError(payload?.error ?? "Failed to cancel job");
        return;
      }

      setJobs((current) =>
        current.map((job) => (job.id === jobId ? payload.job! : job)),
      );
    } finally {
      setPendingJobId(null);
    }
  }

  if (jobs.length === 0) {
    return (
      <p className="ql-subtitle">
        No jobs yet. Start one above.
      </p>
    );
  }

  return (
    <div className="ql-grid">
      {error ? (
        <p className="ql-alert ql-alert-error" role="alert">
          {error}
        </p>
      ) : null}
      {jobs.map((job) => (
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
            <span>
              Audio: {job.audio_storage_path ? "Uploaded" : "Pending"}
            </span>
            {job.audio_storage_path ? (
              <span className="ql-mono">{job.audio_storage_path}</span>
            ) : null}
          </div>

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

          {ACTIVE_STATUSES.has(job.status) ? (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="ql-button-secondary"
                disabled={pendingJobId === job.id}
                onClick={() => handleCancel(job.id)}
              >
                {pendingJobId === job.id ? "Cancelling..." : "Cancel Job"}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
