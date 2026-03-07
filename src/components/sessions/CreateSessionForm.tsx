"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateSessionForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_label: formData.get("patient_label"),
          session_type: formData.get("session_type"),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; session?: { id: string } }
        | null;

      if (!response.ok || !payload?.session?.id) {
        setError(payload?.error ?? "Failed to create session");
        return;
      }

      router.push(`/sessions/${payload.session.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="ql-panel" data-testid="create-session-form">
      <p className="ql-kicker">Create</p>
      <h2 className="ql-panel-title">New Session</h2>

      {error && (
        <p className="ql-alert ql-alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="ql-filter-row" style={{ marginTop: 12 }}>
        <div className="ql-field" style={{ minWidth: 220, flex: "1 1 220px" }}>
          <label htmlFor="patient_label" className="ql-label">
            Patient Label
          </label>
          <input
            id="patient_label"
            name="patient_label"
            type="text"
            required
            placeholder="e.g. Patient A"
            className="ql-input"
            data-testid="session-patient-label"
          />
        </div>
        <div className="ql-field" style={{ width: 160 }}>
          <label htmlFor="session_type" className="ql-label">
            Type
          </label>
          <select
            id="session_type"
            name="session_type"
            defaultValue="general"
            className="ql-select"
            data-testid="session-type-select"
          >
            <option value="general">General</option>
            <option value="intake">Intake</option>
            <option value="follow-up">Follow-up</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="ql-button"
          style={{ marginTop: 17 }}
          data-testid="create-session-submit"
        >
          {pending ? "Creating..." : "Create Session"}
        </button>
      </div>
    </form>
  );
}
