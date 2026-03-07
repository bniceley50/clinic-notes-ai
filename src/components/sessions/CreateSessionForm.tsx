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
    <form action={action} className="card-ql p-5 mt-6">
      <h2
        className="text-xs font-bold uppercase tracking-wider mb-4"
        style={{ color: "#517AB7" }}
      >
        New Session
      </h2>

      {state.error && (
        <p className="mb-3 text-sm font-medium" style={{ color: "#CC2200" }} role="alert">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="patient_label"
            className="block text-xs font-semibold mb-1"
            style={{ color: "#517AB7", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Patient Label
          </label>
          <input
            id="patient_label"
            name="patient_label"
            type="text"
            required
            placeholder="e.g. Patient A"
            className="input-ql"
          />
        </div>

        <div>
          <label
            htmlFor="session_type"
            className="block text-xs font-semibold mb-1"
            style={{ color: "#517AB7", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Session Type
          </label>
          <select
            id="session_type"
            name="session_type"
            defaultValue="general"
            className="input-ql"
          >
            <option value="general">General</option>
            <option value="intake">Intake</option>
            <option value="follow-up">Follow-up</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-ql mt-4"
      >
        {pending ? "Creating…" : "Create Session"}
      </button>
    </form>
  );
}
