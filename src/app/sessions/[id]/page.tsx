import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";
import { ACTIVE_JOB_STATUSES, getJobsForSession } from "@/lib/jobs/queries";
import { AppShell } from "@/components/layout/AppShell";
import { SessionDetailManager } from "@/components/sessions/SessionDetailManager";
import { AudioUpload } from "@/components/jobs/AudioUpload";
import { JobStatusPanel } from "@/components/jobs/JobStatusPanel";

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
  const jobsResult = await getJobsForSession(user, id);

  if (error || !session) {
    notFound();
  }

  if (jobsResult.error) {
    throw new Error("Failed to load jobs");
  }

  const jobs = jobsResult.data;
  const hasActiveJob = jobs.some((job) =>
    ACTIVE_JOB_STATUSES.includes(
      job.status as (typeof ACTIVE_JOB_STATUSES)[number],
    ),
  );

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
      <SessionDetailManager session={session} />

      <div className="ql-grid ql-grid-2">
        <AudioUpload sessionId={session.id} hasActiveJob={hasActiveJob} />
        <section className="ql-panel">
          <p className="ql-kicker">Queue</p>
          <h2 className="ql-panel-title">Job Status</h2>
          <JobStatusPanel initialJobs={jobs} />
        </section>
      </div>
    </AppShell>
  );
}
