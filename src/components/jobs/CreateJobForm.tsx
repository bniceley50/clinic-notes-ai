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
    <form action={action} className="card-ql p-4">
      <input type="hidden" name="session_id" value={sessionId} />

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label
            htmlFor="note_type"
            className="block text-xs font-semibold mb-1"
            style={{ color: "#517AB7", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Note Type
          </label>
          <select
            id="note_type"
            name="note_type"
            data-testid="job-note-type"
            defaultValue="soap"
            disabled={hasActiveJob || pending}
            className="input-ql disabled:opacity-50"
            style={{ minWidth: "160px" }}
            form=""
          >
            <option value="soap">SOAP</option>
            <option value="dap">DAP</option>
            <option value="birp">BIRP</option>
            <option value="girp">GIRP</option>
            <option value="intake">Intake</option>
            <option value="progress">Progress</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={hasActiveJob || pending}
            className="btn-ql"
          >
            {pending ? "Creating…" : "Start Job"}
          </button>
        </div>
      </div>

      {hasActiveJob && !state.error && (
        <p className="mt-2 text-xs font-medium" style={{ color: "#746EB1" }}>
          This session already has an active job running.
        </p>
      )}

      {state.error && (
        <p className="mt-2 text-sm font-medium" style={{ color: "#CC2200" }} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
