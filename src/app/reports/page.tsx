import { redirect } from "next/navigation";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { AppShell } from "@/components/layout/AppShell";
import { CompactFilterBar } from "@/components/ui/CompactFilterBar";
import { StatCard } from "@/components/ui/StatCard";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default async function ReportsPage() {
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
      title="Reports"
      subtitle={`${user.profile.display_name} | ${user.org.name}`}
      displayName={user.profile.display_name}
      orgName={user.org.name}
    >
      <div className="ql-grid ql-grid-4">
        <StatCard label="Sessions" value={sessions.length} note="Total records" />
        <StatCard label="Active" value={activeCount} note="Open work" />
        <StatCard label="Completed" value={completedCount} note="Closed work" />
        <StatCard
          label="Conversion"
          value={`${sessions.length === 0 ? 0 : Math.round((completedCount / sessions.length) * 100)}%`}
          note="Completed / total"
        />
      </div>

      <CompactFilterBar>
        <div className="ql-field" style={{ width: 170 }}>
          <label className="ql-label" htmlFor="report-range">
            Date Range
          </label>
          <select id="report-range" className="ql-select" defaultValue="30" disabled>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>
        <div className="ql-field" style={{ width: 160 }}>
          <label className="ql-label" htmlFor="report-status">
            Status
          </label>
          <select id="report-status" className="ql-select" defaultValue="all" disabled>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <button type="button" className="ql-button-secondary">
          Run Report
        </button>
      </CompactFilterBar>

      <div className="ql-grid ql-grid-2">
        <section className="ql-panel">
          <p className="ql-kicker">Reporting</p>
          <h2 className="ql-panel-title">Session Detail Table</h2>
          {error ? (
            <div className="ql-alert ql-alert-error">
              Failed to load report data: {error}
            </div>
          ) : (
            <div className="ql-table-wrap" style={{ marginTop: 10 }}>
              <table className="ql-table ql-table-dense">
                <thead>
                  <tr>
                    <th>Patient Label</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No report rows available.</td>
                    </tr>
                  ) : (
                    sessions.map((session) => (
                      <tr key={session.id}>
                        <td>{session.patient_label ?? "Untitled session"}</td>
                        <td>{session.session_type}</td>
                        <td>{session.status}</td>
                        <td>{formatDate(session.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="ql-chart-box">
          <p className="ql-kicker">Reporting Snapshot</p>
          <h2 className="ql-panel-title">Volume Overview</h2>
          <p className="ql-subtitle">
            Chart remains secondary to the report table to match enterprise
            reporting patterns.
          </p>
          <div className="ql-chart-bars" aria-hidden="true">
            <div className="ql-chart-bar" style={{ height: "42%" }} />
            <div className="ql-chart-bar" style={{ height: "55%" }} />
            <div className="ql-chart-bar" style={{ height: "72%" }} />
            <div className="ql-chart-bar" style={{ height: "61%" }} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
