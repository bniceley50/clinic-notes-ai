import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";
import { getJobsForSession } from "@/lib/jobs/queries";
import { AppShell } from "@/components/layout/AppShell";
import { CreateJobForm } from "@/components/jobs/CreateJobForm";
import { JobStatusPanel } from "@/components/jobs/JobStatusPanel";
import { AudioUpload } from "@/components/jobs/AudioUpload";
import { NoteViewer } from "@/components/session/NoteViewer";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SessionDetailPage({ params }: Props) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  const { user } = result;
  const { id } = await params;
  const { data: session, error } = await getMySession(user, id);

  if (error || !session) {
    notFound();
  }

  const { data: jobs } = await getJobsForSession(user, id);
  const hasActiveJob = jobs.some(
    (j) => j.status === "queued" || j.status === "running",
  );
  const latestJob = jobs[0];
  const sessionDate = new Date(session.created_at).toLocaleDateString();

  return (
    <AppShell
      title={session.patient_label || "Untitled session"}
      subtitle={`${user.org.name} | ${session.session_type}`}
      displayName={user.profile.display_name}
      orgName={user.org.name}
      actions={
        <Link href="/sessions" className="ql-button-secondary">
          All Sessions
        </Link>
      }
    >
      <section className="ql-panel">
        <div className="ql-copy-row">
          <div>
            <p className="ql-kicker">Clinical Workspace</p>
            <h2 className="ql-panel-title">Session Summary</h2>
          </div>
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
        </div>

        <div className="ql-meta-grid" style={{ marginTop: 10 }}>
          <div className="ql-meta-item">
            <div className="ql-meta-label">Type</div>
            <div className="ql-meta-value">{session.session_type}</div>
          </div>
          <div className="ql-meta-item">
            <div className="ql-meta-label">Status</div>
            <div className="ql-meta-value">{session.status}</div>
          </div>
          <div className="ql-meta-item">
            <div className="ql-meta-label">Created</div>
            <div className="ql-meta-value">
              {new Date(session.created_at).toLocaleString()}
            </div>
          </div>
          <div className="ql-meta-item">
            <div className="ql-meta-label">Last Updated</div>
            <div className="ql-meta-value">
              {new Date(session.updated_at).toLocaleString()}
            </div>
          </div>
          <div className="ql-meta-item">
            <div className="ql-meta-label">Completed</div>
            <div className="ql-meta-value">
              {session.completed_at
                ? new Date(session.completed_at).toLocaleString()
                : "-"}
            </div>
          </div>
          <div className="ql-meta-item">
            <div className="ql-meta-label">Session ID</div>
            <div className="ql-meta-value ql-mono">{session.id}</div>
          </div>
        </div>
      </section>

      <div className="ql-grid ql-grid-2">
        <AudioUpload />
        <CreateJobForm sessionId={session.id} hasActiveJob={hasActiveJob} />
      </div>

      <JobStatusPanel initialJobs={jobs} />

      <NoteViewer
        noteType={latestJob?.note_type ?? "soap"}
        sessionDate={sessionDate}
        patientLabel={session.patient_label ?? "Patient A"}
        providerName={user.profile.display_name}
      />
    </AppShell>
  );
}
