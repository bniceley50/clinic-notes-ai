import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";
import { getJobsForSession } from "@/lib/jobs/queries";
import { CreateJobForm } from "@/components/jobs/CreateJobForm";
import { JobStatusPanel } from "@/components/jobs/JobStatusPanel";
import { NoteViewer } from "@/components/session/NoteViewer";
import { AppShell } from "@/components/layout/AppShell";

type Props = {
  params: Promise<{ id: string }>;
};

const SESSION_STATUS_CHIP: Record<string, string> = {
  active:    "chip-running",
  completed: "chip-complete",
  archived:  "chip-cancelled",
};

export default async function SessionDetailPage({ params }: Props) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  const { user } = result;
  const { id } = await params;
  const { data: session, error } = await getMySession(user, id);

  if (error || !session) notFound();

  const { data: jobs } = await getJobsForSession(user, id);
  const hasActiveJob = jobs.some(
    (j) => j.status === "queued" || j.status === "running",
  );

  // Most recent completed job with note output
  const completedJob = jobs.find(
    (j) => j.status === "complete" || j.status === "completed",
  );

  return (
    <AppShell
      user={{
        displayName: user.profile.display_name,
        orgName: user.org.name,
        role: user.role,
      }}
    >
      {/* ── Breadcrumb + status ──────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/sessions"
          className="text-xs font-medium no-underline"
          style={{ color: "#517AB7" }}
        >
          ← All Sessions
        </Link>
        <span
          className={`inline-block rounded-[2px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            SESSION_STATUS_CHIP[session.status] ?? "chip-cancelled"
          }`}
        >
          {session.status}
        </span>
      </div>

      {/* ── Two-column workspace layout ──────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "300px 1fr" }}>

        {/* Left: Session metadata + job controls */}
        <div className="space-y-4">

          {/* Session info card */}
          <div className="card-ql overflow-hidden">
            <div
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider border-b"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Session
            </div>
            <table>
              <tbody>
                <tr>
                  <td
                    className="text-xs font-semibold w-28"
                    style={{ color: "#517AB7" }}
                  >
                    Patient
                  </td>
                  <td
                    className="text-xs font-semibold"
                    style={{ color: "#0B1215" }}
                  >
                    {session.patient_label || "Untitled"}
                  </td>
                </tr>
                <tr>
                  <td className="text-xs font-semibold" style={{ color: "#517AB7" }}>
                    Type
                  </td>
                  <td className="text-xs" style={{ color: "#333333" }}>
                    {session.session_type}
                  </td>
                </tr>
                <tr>
                  <td className="text-xs font-semibold" style={{ color: "#517AB7" }}>
                    Created
                  </td>
                  <td className="text-xs" style={{ color: "#777777" }}>
                    {new Date(session.created_at).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="text-xs font-semibold" style={{ color: "#517AB7" }}>
                    Updated
                  </td>
                  <td className="text-xs" style={{ color: "#777777" }}>
                    {new Date(session.updated_at).toLocaleString()}
                  </td>
                </tr>
                {session.completed_at && (
                  <tr>
                    <td className="text-xs font-semibold" style={{ color: "#517AB7" }}>
                      Completed
                    </td>
                    <td className="text-xs" style={{ color: "#777777" }}>
                      {new Date(session.completed_at).toLocaleString()}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="text-xs font-semibold" style={{ color: "#517AB7" }}>
                    Provider
                  </td>
                  <td className="text-xs" style={{ color: "#333333" }}>
                    {user.profile.display_name}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Generate note section */}
          <div className="card-ql overflow-hidden">
            <div
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider border-b"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Generate Note
            </div>
            <div className="p-3">
              <CreateJobForm
                sessionId={session.id}
                hasActiveJob={hasActiveJob}
              />
            </div>
          </div>

          {/* Job history */}
          <div className="card-ql overflow-hidden">
            <div
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider border-b"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Job History
            </div>
            <div className="p-3">
              <JobStatusPanel initialJobs={jobs} />
            </div>
          </div>
        </div>

        {/* Right: Note viewer */}
        <div>
          <NoteViewer
            content={completedJob ? "" : ""}
            noteType={completedJob?.note_type ?? "soap"}
            sessionDate={new Date(session.created_at).toLocaleDateString()}
            patientLabel={session.patient_label ?? "Untitled"}
            providerName={user.profile.display_name}
            reviewed={false}
          />
        </div>
      </div>
    </AppShell>
  );
}
