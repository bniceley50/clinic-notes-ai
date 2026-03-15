import { redirect } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";

const SESSION_STATUS_CHIP: Record<string, string> = {
  active:    "chip-running",
  completed: "chip-complete",
  archived:  "chip-cancelled",
};

export default async function DashboardPage() {
  const result = await loadCurrentUser();

  if (result.status === "no_session") redirect("/login");

  /* Error states (no shell, full-screen) */
  if (result.status === "no_profile" || result.status === "no_org" || result.status === "error") {
    const title =
      result.status === "no_profile" ? "Profile not found" :
      result.status === "no_org"     ? "Organization not found" :
                                       "Something went wrong";
    const message =
      result.status === "error" ? result.message :
      result.status === "no_profile" ? "An administrator needs to provision your access." :
      "Your session references an organization that does not exist.";

    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#F9F9F9" }}>
        <div className="card-ql w-full max-w-md p-8 space-y-4">
          <h1 className="text-base font-bold" style={{ color: "#CC2200" }}>{title}</h1>
          <p className="text-sm" style={{ color: "#333333" }}>{message}</p>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="btn-ql-ghost text-sm">Sign out</button>
          </form>
        </div>
      </main>
    );
  }

  const { user } = result;
  const { data: sessions } = await listMySessions(user);

  /* Compute stats */
  const totalSessions   = sessions.length;
  const activeSessions  = sessions.filter((s) => s.status === "active").length;
  const completedSessions = sessions.filter((s) => s.status === "completed").length;

  // Sessions in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSessions = sessions.filter(
    (s) => new Date(s.created_at) >= sevenDaysAgo,
  ).length;

  // Most recent 10 for the table
  const recentRows = sessions.slice(0, 10);

  return (
    <AppShell
      user={{
        displayName: user.profile.display_name,
        orgName: user.org.name,
        role: user.role,
      }}
      userId={user.userId}
    >
      {/* Page heading */}
      <div className="mb-5">
        <h1
          className="text-base font-bold uppercase tracking-wider"
          style={{ color: "#517AB7" }}
        >
          Dashboard
        </h1>
        <p className="mt-0.5 text-xs" style={{ color: "#777777" }}>
          {user.org.name} - {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Total Sessions"
          value={totalSessions}
          subtext="all time"
          variant="accent"
        />
        <StatCard
          label="Active"
          value={activeSessions}
          subtext="currently open"
          variant="primary"
        />
        <StatCard
          label="Completed"
          value={completedSessions}
          subtext="notes generated"
          variant="success"
        />
        <StatCard
          label="Last 7 Days"
          value={recentSessions}
          subtext="new sessions"
          variant="muted"
        />
      </div>

      {/* Two-column content area */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 280px" }}>

        {/* Recent sessions table */}
        <div className="card-ql overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC" }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#517AB7" }}
            >
              Recent Sessions
            </span>
            <Link
              href="/sessions"
              className="text-xs no-underline font-medium"
              style={{ color: "#517AB7" }}
            >
              View all
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8"
                    style={{ color: "#777777" }}
                  >
                    No sessions yet.{" "}
                    <Link href="/sessions" style={{ color: "#517AB7" }}>
                      Create one
                    </Link>
                  </td>
                </tr>
              )}
              {recentRows.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-xs" style={{ color: "#0B1215" }}>
                    {s.patient_label || "Untitled"}
                  </td>
                  <td>
                    <span
                      className="inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-medium uppercase"
                      style={{ backgroundColor: "#F0F0F0", color: "#333333" }}
                    >
                      {s.session_type}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        SESSION_STATUS_CHIP[s.status] ?? "chip-cancelled"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: "#777777" }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="text-xs font-medium no-underline"
                      style={{ color: "#517AB7" }}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column: provider card + quick actions */}
        <div className="space-y-4">

          {/* Provider info */}
          <div className="card-ql overflow-hidden">
            <div
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider border-b"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Provider
            </div>
            <table>
              <tbody>
                <tr>
                  <td className="text-xs font-semibold w-20" style={{ color: "#517AB7" }}>
                    Name
                  </td>
                  <td className="text-xs font-semibold" style={{ color: "#0B1215" }}>
                    {user.profile.display_name}
                  </td>
                </tr>
                <tr>
                  <td className="text-xs font-semibold" style={{ color: "#517AB7" }}>
                    Role
                  </td>
                  <td>
                    <span
                      className="inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase chip-running"
                    >
                      {user.role}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="text-xs font-semibold" style={{ color: "#517AB7" }}>
                    Org
                  </td>
                  <td className="text-xs" style={{ color: "#333333" }}>
                    {user.org.name}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Quick actions */}
          <div className="card-ql overflow-hidden">
            <div
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider border-b"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Quick Actions
            </div>
            <div className="p-3 space-y-2">
              <Link
                href="/sessions"
                className="btn-ql w-full justify-start text-xs no-underline"
              >
                + New Session
              </Link>
              <Link
                href="/schedule"
                className="btn-ql-ghost w-full justify-start text-xs no-underline"
              >
                View Schedule
              </Link>
              <Link
                href="/reports"
                className="btn-ql-ghost w-full justify-start text-xs no-underline"
              >
                View Reports
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
