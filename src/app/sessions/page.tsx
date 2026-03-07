import { redirect } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { CreateSessionForm } from "@/components/sessions/CreateSessionForm";
import { AppShell } from "@/components/layout/AppShell";

/* Status → CareLogic-aligned chip class */
const SESSION_STATUS_CHIP: Record<string, string> = {
  active:    "chip-running",
  completed: "chip-complete",
  archived:  "chip-cancelled",
};

export default async function SessionsPage() {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  const { user } = result;
  const { data: sessions, error } = await listMySessions(user);

  return (
    <AppShell
      user={{
        displayName: user.profile.display_name,
        orgName: user.org.name,
        role: user.role,
      }}
    >
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold uppercase tracking-wider" style={{ color: "#517AB7" }}>
            Sessions
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: "#777777" }}>
            {user.org.name} — {user.profile.display_name}
          </p>
        </div>
      </div>

      {/* Create session form */}
      <CreateSessionForm />

      {/* Error state */}
      {error && (
        <p className="mt-4 text-sm font-medium" style={{ color: "#CC2200" }}>
          Failed to load sessions: {error}
        </p>
      )}

      {/* Sessions table */}
      <div className="mt-6 card-ql overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>Patient Label</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="text-center py-8" style={{ color: "#777777" }}>
                  No sessions yet. Create one above.
                </td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="font-medium" style={{ color: "#0B1215" }}>
                  {s.patient_label || "Untitled session"}
                </td>
                <td>
                  <span
                    className="inline-block rounded-[2px] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                    style={{ backgroundColor: "#F0F0F0", color: "#333333" }}
                  >
                    {s.session_type}
                  </span>
                </td>
                <td>
                  <span
                    className={`inline-block rounded-[2px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      SESSION_STATUS_CHIP[s.status] ?? "chip-cancelled"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="text-xs" style={{ color: "#777777" }}>
                  {new Date(s.created_at).toLocaleString()}
                </td>
                <td className="text-right">
                  <Link
                    href={`/sessions/${s.id}`}
                    className="text-xs font-semibold no-underline rounded-[2px] px-3 py-1"
                    style={{
                      color: "#517AB7",
                      border: "1px solid #E7E9EC",
                    }}
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
