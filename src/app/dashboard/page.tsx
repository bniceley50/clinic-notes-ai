import { redirect } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default async function DashboardPage() {
  const result = await loadCurrentUser();

  if (result.status === "no_session") {
    redirect("/login");
  }

  if (result.status === "no_profile") {
    return (
      <main className="ql-page-bg">
        <div className="ql-page" style={{ paddingTop: 24 }}>
          <section className="ql-panel" style={{ maxWidth: 640 }}>
            <h1 className="ql-panel-title">Profile not found</h1>
            <p className="ql-subtitle">
            Your account exists but no profile has been created yet. An
            administrator needs to provision your access.
            </p>
            <dl className="ql-grid" style={{ marginTop: 12 }}>
              <div className="ql-meta-item">
                <dt className="ql-meta-label">User ID</dt>
                <dd className="ql-meta-value ql-mono">{result.userId}</dd>
              </div>
              <div className="ql-meta-item">
                <dt className="ql-meta-label">Org ID</dt>
                <dd className="ql-meta-value ql-mono">{result.orgId}</dd>
              </div>
            </dl>
            <form action="/api/auth/logout" method="POST" style={{ marginTop: 12 }}>
              <button type="submit" className="ql-button-secondary">
                Sign Out
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  if (result.status === "no_org") {
    return (
      <main className="ql-page-bg">
        <div className="ql-page" style={{ paddingTop: 24 }}>
          <section className="ql-panel" style={{ maxWidth: 640 }}>
            <h1 className="ql-panel-title">Organization not found</h1>
            <p className="ql-subtitle">
              Your session references an organization that does not exist in the
              database. This may indicate a data integrity issue.
            </p>
            <form action="/api/auth/logout" method="POST" style={{ marginTop: 12 }}>
              <button type="submit" className="ql-button-secondary">
                Sign Out
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  if (result.status === "error") {
    return (
      <main className="ql-page-bg">
        <div className="ql-page" style={{ paddingTop: 24 }}>
          <section className="ql-panel" style={{ maxWidth: 640 }}>
            <h1 className="ql-panel-title">Something went wrong</h1>
            <div className="ql-alert ql-alert-error">{result.message}</div>
            <form action="/api/auth/logout" method="POST" style={{ marginTop: 12 }}>
              <button type="submit" className="ql-button-secondary">
                Sign Out
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const { user } = result;
  const { data: sessions, error } = await listMySessions(user);
  const activeSessions = sessions.filter((session) => session.status === "active");
  const completedSessions = sessions.filter(
    (session) => session.status === "completed",
  );
  const recentSessions = sessions.slice(0, 6);

  return (
    <AppShell
      title="Dashboard"
      subtitle={`${user.profile.display_name} | ${user.org.name}`}
      displayName={user.profile.display_name}
      orgName={user.org.name}
      actions={
        <Link href="/sessions" className="ql-button">
          Client Worklist
        </Link>
      }
    >
      <div className="ql-grid ql-grid-4">
        <StatCard
          label="Total Sessions"
          value={sessions.length}
          note="Current provider worklist"
        />
        <StatCard
          label="Active"
          value={activeSessions.length}
          note="Open clinical work"
        />
        <StatCard
          label="Completed"
          value={completedSessions.length}
          note="Finalized session records"
        />
        <StatCard
          label="Organization"
          value={user.org.name}
          note={`Role: ${user.role}`}
        />
      </div>

      <section className="ql-panel">
        <div className="ql-title-row" style={{ marginBottom: 8 }}>
          <div>
            <p className="ql-kicker">Worklist</p>
            <h2 className="ql-panel-title">Recent Sessions</h2>
          </div>
          <Link href="/sessions" className="ql-button-secondary">
            Open Sessions
          </Link>
        </div>

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
                </tr>
              </thead>
              <tbody>
                {recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No sessions available.</td>
                  </tr>
                ) : (
                  recentSessions.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <Link href={`/sessions/${session.id}`}>
                          {session.patient_label ?? "Untitled session"}
                        </Link>
                      </td>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ql-grid ql-grid-2">
        <section className="ql-panel">
          <p className="ql-kicker">Session Context</p>
          <h2 className="ql-panel-title">User Context</h2>
          <div className="ql-meta-grid">
            <div className="ql-meta-item">
              <div className="ql-meta-label">Display Name</div>
              <div className="ql-meta-value">{user.profile.display_name}</div>
            </div>
            <div className="ql-meta-item">
              <div className="ql-meta-label">Role</div>
              <div className="ql-meta-value">{user.role}</div>
            </div>
            <div className="ql-meta-item">
              <div className="ql-meta-label">User ID</div>
              <div className="ql-meta-value ql-mono">{user.userId}</div>
            </div>
            <div className="ql-meta-item">
              <div className="ql-meta-label">Org ID</div>
              <div className="ql-meta-value ql-mono">{user.orgId}</div>
            </div>
            <div className="ql-meta-item">
              <div className="ql-meta-label">Email</div>
              <div className="ql-meta-value">{user.email ?? "-"}</div>
            </div>
            <div className="ql-meta-item">
              <div className="ql-meta-label">Member Since</div>
              <div className="ql-meta-value">
                {new Date(user.profile.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </section>

        <section className="ql-chart-box">
          <p className="ql-kicker">Reporting Snapshot</p>
          <h2 className="ql-panel-title">Session Volume</h2>
          <p className="ql-subtitle">
            Subdued chart treatment to preserve the compact enterprise reporting
            feel across the app.
          </p>
          <div className="ql-chart-bars" aria-hidden="true">
            <div className="ql-chart-bar" style={{ height: "52%" }} />
            <div className="ql-chart-bar" style={{ height: "68%" }} />
            <div className="ql-chart-bar" style={{ height: "61%" }} />
            <div className="ql-chart-bar" style={{ height: "78%" }} />
          </div>
        </section>
      </section>
    </AppShell>
  );
}
