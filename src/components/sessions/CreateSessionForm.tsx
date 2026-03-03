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
    <form
      action={action}
      className="mt-8 rounded-lg border bg-white p-6 shadow-sm"
    >
      <h2 className="text-sm font-medium text-gray-900">New Session</h2>

      {state.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="patient_label"
            className="block text-sm font-medium text-gray-700"
          >
            Patient Label
          </label>
          <input
            id="patient_label"
            name="patient_label"
            type="text"
            required
            placeholder="e.g. Patient A"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="session_type"
            className="block text-sm font-medium text-gray-700"
          >
            Type
          </label>
          <select
            id="session_type"
            name="session_type"
            defaultValue="general"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Session"}
      </button>
    </form>
  );
}
