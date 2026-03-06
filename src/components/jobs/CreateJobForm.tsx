"use client";

import { useActionState } from "react";
import {
  createJobAction,
  type JobActionResult,
} from "@/lib/jobs/actions";

const initial: JobActionResult = { error: null };

type Props = {
  sessionId: string;
  hasActiveJob: boolean;
};

export function CreateJobForm({ sessionId, hasActiveJob }: Props) {
  const [state, action, pending] = useActionState(
    createJobAction,
    initial,
  );

  return (
    <form action={action} className="ql-panel">
      <p className="ql-kicker">Drafting</p>
      <h2 className="ql-panel-title">Start Note Job</h2>
      <input type="hidden" name="session_id" value={sessionId} />

      <div className="ql-filter-row" style={{ marginTop: 12 }}>
        <div className="ql-field" style={{ minWidth: 180, flex: "1 1 180px" }}>
          <label htmlFor="note_type" className="ql-label">
            Note Type
          </label>
          <select
            id="note_type"
            name="note_type"
            defaultValue="soap"
            disabled={hasActiveJob || pending}
            className="ql-select"
          >
            <option value="soap">SOAP</option>
            <option value="dap">DAP</option>
            <option value="birp">BIRP</option>
            <option value="girp">GIRP</option>
            <option value="intake">Intake</option>
            <option value="progress">Progress</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={hasActiveJob || pending}
          className="ql-button"
          style={{ marginTop: 17 }}
        >
          {pending ? "Creating..." : "Start Job"}
        </button>
      </div>

      {hasActiveJob && !state.error && (
        <p className="ql-alert ql-alert-warning" style={{ marginTop: 8 }}>
          This session already has an active job.
        </p>
      )}

      {state.error && (
        <p
          className="ql-alert ql-alert-error"
          role="alert"
          style={{ marginTop: 8 }}
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
