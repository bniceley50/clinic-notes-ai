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
  const trimmedIdentifier = patientIdentifier.trim();
  const looksLikeName = /[a-z]{2,}\s+[a-z]{2,}/i.test(trimmedIdentifier);
  const longWithSpace =
    trimmedIdentifier.length > 15 && trimmedIdentifier.includes(" ");
  const isBlocked = looksLikeName || longWithSpace;

  return (
    <form
      action={action}
      className="card-ql mt-6 p-5"
      data-testid="create-session-form"
    >
      <h2
        className="mb-4 text-xs font-bold uppercase tracking-wider text-accent"
      >
        New Session
      </h2>

      {state.error && (
        <p
          className="mb-3 text-sm font-medium text-alert"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="patient_label"
            className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-accent"
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
          <p className="mt-1 text-xs text-text-muted">
            Use chart numbers or initials only. Do not enter real patient
            names.
          </p>
          {isBlocked && (
            <div
              className="text-sm font-bold text-red-600 bg-red-50 border border-red-300 p-2 rounded mt-1"
              role="alert"
            >
              Patient names are not allowed. Use chart numbers, initials, or
              short identifiers to protect patient privacy.
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="session_type"
            className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-accent"
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
        disabled={pending || isBlocked}
        className="btn-ql mt-4"
        data-testid="create-session-submit"
      >
        {pending ? "Creating..." : "Create Session"}
      </button>
    </form>
  );
}
