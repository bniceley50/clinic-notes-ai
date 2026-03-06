"use client";

import { useActionState } from "react";
import {
  createSessionAction,
  type ActionResult,
} from "@/lib/sessions/actions";

const initial: ActionResult = { error: null };

export function CreateSessionForm() {
  const [state, action, pending] = useActionState(
    createSessionAction,
    initial,
  );

  return (
    <form action={action} className="ql-panel">
      <p className="ql-kicker">Create</p>
      <h2 className="ql-panel-title">New Session</h2>

      {state.error && (
        <p className="ql-alert ql-alert-error" role="alert">
          {state.error}
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
        >
          {pending ? "Creating..." : "Create Session"}
        </button>
      </div>
    </form>
  );
}
