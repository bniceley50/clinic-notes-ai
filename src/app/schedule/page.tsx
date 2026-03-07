import { redirect } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { AppShell } from "@/components/layout/AppShell";

const SESSION_STATUS_CHIP: Record<string, string> = {
  active:    "chip-running",
  completed: "chip-complete",
  archived:  "chip-cancelled",
};

function formatDateHeading(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export default async function SchedulePage() {
  const result = await loadCurrentUser();
  if (result.status !== "authenticated") redirect("/login");

  const { user } = result;
  const { data: sessions } = await listMySessions(user);

  const grouped = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = toDateKey(new Date(s.created_at));
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));
  const todayKey = toDateKey(new Date());

  return (
    <AppShell
      user={{ displayName: user.profile.display_name, orgName: user.org.name, role: user.role }}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold uppercase tracking-wider" style={{ color: "#517AB7" }}>
            Schedule
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: "#777777" }}>
            Session history by day — {user.org.name}
          </p>
        </div>
        <Link href="/sessions" className="btn-ql text-xs no-underline">
          + New Session
        </Link>
      </div>

      {sortedDates.length === 0 && (
        <div className="card-ql p-8 text-center text-sm" style={{ color: "#777777" }}>
          No sessions yet.{" "}
          <Link href="/sessions" style={{ color: "#517AB7" }}>Create your first session →</Link>
        </div>
      )}

      <div className="space-y-4">
        {sortedDates.map((dateKey) => {
          const daySessions = grouped.get(dateKey) ?? [];
          const isToday = dateKey === todayKey;
          const dateLabel = formatDateHeading(new Date(dateKey + "T12:00:00"));
          return (
            <div key={dateKey} className="card-ql overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-2 border-b"
                style={{ backgroundColor: isToday ? "#EEF2FF" : "#F9F9F9", borderColor: "#E7E9EC" }}
              >
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: isToday ? "#3B276A" : "#517AB7" }}>
                  {dateLabel}
                </span>
                {isToday && (
                  <span className="rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase chip-running">
                    Today
                  </span>
                )}
                <span className="ml-auto text-xs" style={{ color: "#777777" }}>
                  {daySessions.length} session{daySessions.length !== 1 ? "s" : ""}
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>Time</th>
                    <th>Patient</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {daySessions.map((s) => (
                    <tr key={s.id}>
                      <td className="text-xs font-mono" style={{ color: "#777777" }}>{formatTime(s.created_at)}</td>
                      <td className="text-xs font-semibold" style={{ color: "#0B1215" }}>{s.patient_label || "Untitled"}</td>
                      <td>
                        <span className="inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-medium uppercase" style={{ backgroundColor: "#F0F0F0", color: "#333333" }}>
                          {s.session_type}
                        </span>
                      </td>
                      <td>
                        <span className={`inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SESSION_STATUS_CHIP[s.status] ?? "chip-cancelled"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link href={`/sessions/${s.id}`} className="text-xs font-medium no-underline" style={{ color: "#517AB7" }}>Open →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
