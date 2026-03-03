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
    <form action={action} className="rounded-lg border bg-white p-4 shadow-sm">
      <input type="hidden" name="session_id" value={sessionId} />

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label
            htmlFor="note_type"
            className="block text-xs font-medium text-gray-600"
          >
            Note Type
          </label>
          <select
            id="note_type"
            name="note_type"
            defaultValue="soap"
            disabled={hasActiveJob || pending}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
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
          className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Start Job"}
        </button>
      </div>

      {hasActiveJob && !state.error && (
        <p className="mt-2 text-xs text-amber-600">
          This session already has an active job.
        </p>
      )}

      {state.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
