"use client";

import { useActionState, useState } from "react";
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
  const [patientIdentifier, setPatientIdentifier] = useState("");
  const looksLikeName = /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(
    patientIdentifier.trim(),
  );

  return (
    <form action={action} className="card-ql p-5 mt-6" data-testid="create-session-form">
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
            Patient Identifier
          </label>
          <input
            id="patient_label"
            name="patient_label"
            type="text"
            required
            placeholder="e.g. Chart #12345 or J.S."
            className="input-ql"
            data-testid="session-patient-label"
            value={patientIdentifier}
            onChange={(event) => setPatientIdentifier(event.target.value)}
          />
          <p className="mt-1 text-xs" style={{ color: "#777777" }}>
            Use chart numbers or initials only. Do not enter real patient names.
          </p>
          {looksLikeName && (
            <div
              className="mt-2 rounded border p-2 text-sm font-medium"
              style={{
                color: "#8A4B08",
                backgroundColor: "#FFF6E8",
                borderColor: "#F2C078",
              }}
              role="alert"
            >
              ⚠️ This looks like a real name. Please use chart numbers or
              initials to protect patient privacy.
            </div>
          )}
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
            data-testid="session-type-select"
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
        data-testid="create-session-submit"
      >
        {pending ? "Creating…" : "Create Session"}
      </button>
    </form>
  );
}
