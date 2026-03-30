"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionRow } from "@/lib/sessions/queries";

type SessionDetailManagerProps = {
  session: SessionRow;
};

const STATUS_CLASS: Record<string, string> = {
  active: "ql-chip is-active",
  completed: "ql-chip is-complete",
  archived: "ql-chip",
};

export function SessionDetailManager({
  session,
}: SessionDetailManagerProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(formData: FormData) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_label: formData.get("patient_label"),
          status: formData.get("status"),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Failed to update session");
        return;
      }

      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleArchive() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Failed to archive session");
        return;
      }

      router.push("/sessions");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ql-panel">
      <div className="ql-copy-row">
        <div>
          <p className="ql-kicker">Session Record</p>
          <h2 className="ql-panel-title">Session Metadata</h2>
        </div>
        <span className={STATUS_CLASS[session.status] ?? "ql-chip"}>
          {session.status}
        </span>
      </div>

      {error ? (
        <div className="ql-alert ql-alert-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      <form action={handleUpdate} className="ql-grid" style={{ marginTop: 10 }}>
        <div className="ql-filter-row">
          <div className="ql-field" style={{ minWidth: 220, flex: "1 1 220px" }}>
            <label htmlFor="patient_label" className="ql-label">
              Patient Label
            </label>
            <input
              id="patient_label"
              name="patient_label"
              defaultValue={session.patient_label ?? ""}
              className="ql-input"
            />
          </div>
          <div className="ql-field" style={{ width: 150 }}>
            <label htmlFor="status" className="ql-label">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={session.status}
              className="ql-select"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="ql-copy-row">
          <div className="ql-meta-grid" style={{ flex: "1 1 auto" }}>
            <div className="ql-meta-item">
              <div className="ql-meta-label">Created</div>
              <div className="ql-meta-value">
                {new Date(session.created_at).toLocaleString()}
              </div>
            </div>
            <div className="ql-meta-item">
              <div className="ql-meta-label">Updated</div>
              <div className="ql-meta-value">
                {new Date(session.updated_at).toLocaleString()}
              </div>
            </div>
            <div className="ql-meta-item">
              <div className="ql-meta-label">Completed</div>
              <div className="ql-meta-value">
                {session.completed_at
                  ? new Date(session.completed_at).toLocaleString()
                  : "-"}
              </div>
            </div>
            <div className="ql-meta-item">
              <div className="ql-meta-label">Session ID</div>
              <div className="ql-meta-value ql-mono">{session.id}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="ql-button" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              className="ql-button-secondary"
              disabled={pending || session.status === "archived"}
              onClick={handleArchive}
            >
              Archive Session
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
