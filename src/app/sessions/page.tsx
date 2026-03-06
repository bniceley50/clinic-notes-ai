import { redirect } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { AppShell } from "@/components/layout/AppShell";
import { CreateSessionForm } from "@/components/sessions/CreateSessionForm";
import { CompactFilterBar } from "@/components/ui/CompactFilterBar";
import { StatCard } from "@/components/ui/StatCard";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default async function SessionsPage() {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  const { user } = result;
  const { data: sessions, error } = await listMySessions(user);
  const activeCount = sessions.filter((session) => session.status === "active").length;
  const completedCount = sessions.filter(
    (session) => session.status === "completed",
  ).length;

  return (
    <AppShell
      title="Sessions"
      subtitle={`${user.profile.display_name} | ${user.org.name}`}
      displayName={user.profile.display_name}
      orgName={user.org.name}
      actions={
        <Link href="/dashboard" className="ql-button-secondary">
          Dashboard
        </Link>
      }
    >
      <div className="ql-grid ql-grid-3">
        <StatCard label="Total" value={sessions.length} note="Session records" />
        <StatCard label="Active" value={activeCount} note="Open work" />
        <StatCard label="Completed" value={completedCount} note="Closed work" />
      </div>

      <CreateSessionForm />

      <section className="ql-grid">
        <CompactFilterBar>
          <div className="ql-field" style={{ width: 220 }}>
            <label className="ql-label" htmlFor="session-search">
              Patient Label
            </label>
            <input
              id="session-search"
              className="ql-input"
              defaultValue=""
              placeholder="Filter current worklist"
              readOnly
            />
          </div>
          <div className="ql-field" style={{ width: 140 }}>
            <label className="ql-label" htmlFor="session-status">
              Status
            </label>
            <select id="session-status" className="ql-select" defaultValue="all" disabled>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="ql-field" style={{ width: 140 }}>
            <label className="ql-label" htmlFor="session-type">
              Type
            </label>
            <select id="session-type" className="ql-select" defaultValue="all" disabled>
              <option value="all">All</option>
              <option value="general">General</option>
              <option value="intake">Intake</option>
              <option value="follow-up">Follow-up</option>
            </select>
          </div>
          <button className="ql-button-secondary" type="button">
            Refresh
          </button>
        </CompactFilterBar>

        {error ? (
          <div className="ql-alert ql-alert-error">
            Failed to load sessions: {error}
          </div>
        ) : (
          <div className="ql-table-wrap">
            <table className="ql-table ql-table-dense">
              <thead>
                <tr>
                  <th>Patient Label</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No sessions yet. Create one above.</td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id}>
                      <td>{session.patient_label || "Untitled session"}</td>
                      <td>{session.session_type}</td>
                      <td>
                        <span
                          className={[
                            "ql-chip",
                            session.status === "active"
                              ? "is-active"
                              : session.status === "completed"
                                ? "is-complete"
                                : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td>{formatDateTime(session.created_at)}</td>
                      <td>{formatDateTime(session.updated_at)}</td>
                      <td>
                        <Link href={`/sessions/${session.id}`}>Open Record</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
