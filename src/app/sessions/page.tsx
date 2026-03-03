import { redirect } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { createSessionAction } from "@/lib/sessions/actions";

export default async function SessionsPage() {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  const { user } = result;
  const { data: sessions, error } = await listMySessions(user);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">
            {user.profile.display_name} &middot; {user.org.name}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Dashboard
        </Link>
      </div>

      <form
        action={createSessionAction}
        className="mt-8 rounded-lg border bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-medium text-gray-900">New Session</h2>
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
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create Session
        </button>
      </form>

      {error && (
        <p className="mt-6 text-sm text-red-600">
          Failed to load sessions: {error}
        </p>
      )}

      <div className="mt-8 space-y-3">
        {sessions.length === 0 && !error && (
          <p className="text-center text-sm text-gray-500">
            No sessions yet. Create one above.
          </p>
        )}

        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/sessions/${s.id}`}
            className="block rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-blue-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {s.patient_label || "Untitled session"}
                </span>
                <span className="ml-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {s.session_type}
                </span>
              </div>
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                  s.status === "active"
                    ? "bg-green-50 text-green-700"
                    : s.status === "completed"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {s.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {new Date(s.created_at).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 border-t pt-4">
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
