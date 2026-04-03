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

const MINI_BAR_CLASS: Record<string, string> = {
  "#517AB7": "[&::-moz-progress-bar]:bg-accent [&::-webkit-progress-value]:bg-accent",
};

function MiniBar({ value, max, color = "#517AB7" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <progress
        className={`h-2 flex-1 overflow-hidden rounded-[2px] [&::-webkit-progress-bar]:bg-border-subtle ${MINI_BAR_CLASS[color] ?? MINI_BAR_CLASS["#517AB7"]}`}
        value={pct}
        max={100}
      />
      <span className="text-xs w-6 text-right text-text-muted">{value}</span>
    </div>
  );
}

export default async function ReportsPage() {
  const result = await loadCurrentUser();
  if (result.status !== "authenticated") redirect("/login");

  const { user } = result;
  const { data: sessions } = await listMySessions(user);

  /* Compute stats */
  const total = sessions.length;
  const active = sessions.filter((s) => s.status === "active").length;
  const completed = sessions.filter((s) => s.status === "completed").length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7 = sessions.filter((s) => new Date(s.created_at) >= sevenDaysAgo).length;

  // Count by session_type
  const typeCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.session_type] = (acc[s.session_type] ?? 0) + 1;
    return acc;
  }, {});
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const maxTypeCount = Math.max(...typeEntries.map(([, v]) => v), 1);

  // Count by status
  const statusCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  // All sessions for the main table (most recent first)
  const tableRows = sessions.slice(0, 50);

  return (
    <AppShell
      user={{ displayName: user.profile.display_name, orgName: user.org.name, role: user.role }}
      userId={user.userId}
    >
      {/* Page heading */}
      <div className="mb-5">
        <h1 className="text-base font-bold uppercase tracking-wider text-accent">
          Reports
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Clinical activity summary - {user.org.name}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Sessions"  value={total}     subtext="all time"          variant="accent"  />
        <StatCard label="Active"          value={active}    subtext="open sessions"      variant="primary" />
        <StatCard label="Completed"       value={completed} subtext="transcriptions complete" variant="success" />
        <StatCard label="Last 7 Days"     value={last7}     subtext="new sessions"       variant="muted"   />
      </div>

      {/* Two-column: table + breakdown charts */}
      <div className="grid grid-cols-[1fr_240px] gap-4">

        {/* Main sessions table */}
        <div className="card-ql overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle bg-nav-bg px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Session Activity
            </span>
            <span className="text-xs text-text-muted">
              Showing {tableRows.length} of {total}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-text-muted">
                    No sessions found.
                  </td>
                </tr>
              )}
              {tableRows.map((s) => (
                <tr key={s.id}>
                  <td className="text-xs font-semibold text-text-dark">
                    {s.patient_label || "Untitled"}
                  </td>
                  <td>
                    <span className="inline-block rounded-[2px] bg-row-alt px-2 py-0.5 text-[10px] font-medium uppercase text-text-body">
                      {s.session_type}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SESSION_STATUS_CHIP[s.status] ?? "chip-cancelled"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="text-xs text-text-muted">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-xs text-text-muted">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <Link href={`/sessions/${s.id}`} className="text-xs font-medium no-underline text-accent">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: breakdown cards */}
        <div className="space-y-4">

          {/* By session type */}
          <div className="card-ql overflow-hidden">
            <div className="border-b border-border-subtle bg-nav-bg px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent">
              By Type
            </div>
            <div className="p-3 space-y-2">
              {typeEntries.length === 0 && (
                <p className="text-xs text-text-muted">No data</p>
              )}
              {typeEntries.map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium capitalize text-text-body">{type}</span>
                    <span className="text-[10px] font-bold text-accent">
                      {Math.round((count / total) * 100)}%
                    </span>
                  </div>
                  <MiniBar value={count} max={maxTypeCount} color="#517AB7" />
                </div>
              ))}
            </div>
          </div>

          {/* By status */}
          <div className="card-ql overflow-hidden">
            <div className="border-b border-border-subtle bg-nav-bg px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent">
              By Status
            </div>
            <div className="p-3 space-y-1.5">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span
                    className={`inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SESSION_STATUS_CHIP[status] ?? "chip-cancelled"}`}
                  >
                    {status}
                  </span>
                  <span className="text-xs font-bold text-text-body">{count}</span>
                </div>
              ))}
              {Object.keys(statusCounts).length === 0 && (
                <p className="text-xs text-text-muted">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
