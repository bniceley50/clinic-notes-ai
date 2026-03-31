import { redirect } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";

const SESSION_STATUS_CHIP: Record<string, string> = {
  active: "chip-running",
  completed: "chip-complete",
  archived: "chip-cancelled",
};

export default async function DashboardPage() {
  const result = await loadCurrentUser();

  if (result.status === "no_session") redirect("/login");

  if (
    result.status === "no_profile" ||
    result.status === "no_org" ||
    result.status === "error"
  ) {
    const title =
      result.status === "no_profile"
        ? "Profile not found"
        : result.status === "no_org"
          ? "Organization not found"
          : "Something went wrong";
    const message =
      result.status === "error"
        ? result.message
        : result.status === "no_profile"
          ? "An administrator needs to provision your access."
          : "Your session references an organization that does not exist.";

    return (
      <main
        className="flex min-h-screen items-center justify-center bg-nav-bg"
      >
        <div className="card-ql w-full max-w-md space-y-4 p-8">
          <h1 className="text-base font-bold text-alert">
            {title}
          </h1>
          <p className="text-sm text-text-body">
            {message}
          </p>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="btn-ql-ghost text-sm">
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { user } = result;
  const { data: sessions } = await listMySessions(user);

  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === "active").length;
  const completedSessions = sessions.filter(
    (s) => s.status === "completed",
  ).length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSessions = sessions.filter(
    (s) => new Date(s.created_at) >= sevenDaysAgo,
  ).length;

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
      <div className="mb-5">
        <h1
          className="text-base font-bold uppercase tracking-wider text-accent"
        >
          Documentation Dashboard
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Your session transcript and EHR extraction workspace
        </p>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-3">
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
          subtext="transcriptions completed"
          variant="success"
        />
        <StatCard
          label="Last 7 Days"
          value={recentSessions}
          subtext="new sessions"
          variant="muted"
        />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 280px" }}>
        <div className="card-ql overflow-hidden">
          <div
            className="flex items-center justify-between border-b px-4 py-2"
            style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC" }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider text-accent"
            >
              Recent Documentation Workspaces
            </span>
            <Link
              href="/sessions"
              className="text-xs font-medium no-underline text-accent"
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
                    className="py-8 text-center text-text-muted"
                  >
                    No sessions yet. Create a session to start a transcript and structured documentation workflow.{" "}
                    <Link href="/sessions" className="text-accent">
                      Create one
                    </Link>
                  </td>
                </tr>
              )}
              {recentRows.map((s) => (
                <tr key={s.id}>
                  <td
                    className="font-medium text-xs text-text-dark"
                  >
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
                  <td className="text-xs text-text-muted">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="text-xs font-medium no-underline text-accent"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="card-ql overflow-hidden">
            <div
              className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: "#F9F9F9",
                borderColor: "#E7E9EC",
                color: "#517AB7",
              }}
            >
              Provider
            </div>
            <table>
              <tbody>
                <tr>
                  <td
                    className="w-20 text-xs font-semibold text-accent"
                  >
                    Name
                  </td>
                  <td
                    className="text-xs font-semibold text-text-dark"
                  >
                    {user.profile.display_name}
                  </td>
                </tr>
                <tr>
                  <td
                    className="text-xs font-semibold text-accent"
                  >
                    Role
                  </td>
                  <td>
                    <span className="inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase chip-running">
                      {user.role}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td
                    className="text-xs font-semibold text-accent"
                  >
                    Org
                  </td>
                  <td className="text-xs text-text-body">
                    {user.org.name}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-ql overflow-hidden">
            <div
              className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: "#F9F9F9",
                borderColor: "#E7E9EC",
                color: "#517AB7",
              }}
            >
              Quick Actions
            </div>
            <div className="space-y-2 p-3">
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
