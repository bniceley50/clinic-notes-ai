import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";
import { ACTIVE_JOB_STATUSES, getJobsForSession } from "@/lib/jobs/queries";
import {
  getLatestNoteForSession,
  getLatestTranscriptForSession,
} from "@/lib/clinical/queries";
import { AppShell } from "@/components/layout/AppShell";
import { SessionDetailManager } from "@/components/sessions/SessionDetailManager";
import { AudioUpload } from "@/components/jobs/AudioUpload";
import { JobStatusPanel } from "@/components/jobs/JobStatusPanel";
import { NoteViewer } from "@/components/session/NoteViewer";
import { TranscriptViewer } from "@/components/session/TranscriptViewer";

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
  const [{ data: session, error }, jobsResult, transcriptResult, noteResult] =
    await Promise.all([
      getMySession(user, id),
      getJobsForSession(user, id),
      getLatestTranscriptForSession(user, id),
      getLatestNoteForSession(user, id),
    ]);

  if (error || !session) {
    notFound();
  }

  if (jobsResult.error) {
    throw new Error("Failed to load jobs");
  }

  if (transcriptResult.error) {
    throw new Error("Failed to load transcript");
  }

  if (noteResult.error) {
    throw new Error("Failed to load note");
  }

  const jobs = jobsResult.data;
  const hasActiveJob = jobs.some((job) =>
    ACTIVE_JOB_STATUSES.includes(
      job.status as (typeof ACTIVE_JOB_STATUSES)[number],
    ),
  );
  const latestTranscript = transcriptResult.data;
  const latestNote = noteResult.data;
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
      <SessionDetailManager session={session} />

      <div className="ql-grid ql-grid-2">
        <AudioUpload sessionId={session.id} hasActiveJob={hasActiveJob} />
        <section className="ql-panel">
          <p className="ql-kicker">Queue</p>
          <h2 className="ql-panel-title">Job Status</h2>
          <JobStatusPanel initialJobs={jobs} />
        </section>
      </div>

      {latestTranscript ? (
        <TranscriptViewer transcript={latestTranscript.content} />
      ) : (
        <section className="ql-panel">
          <p className="ql-kicker">Transcript</p>
          <h2 className="ql-panel-title">Session Transcript</h2>
          <p className="ql-subtitle">
            No transcript yet. Trigger the stub runner after uploading audio.
          </p>
        </section>
      )}

      {latestNote ? (
        <NoteViewer
          noteType={latestNote.note_type}
          sessionDate={sessionDate}
          patientLabel={session.patient_label ?? "Patient A"}
          providerName={user.profile.display_name}
          content={latestNote.content}
        />
      ) : (
        <section className="ql-panel">
          <p className="ql-kicker">Documentation</p>
          <h2 className="ql-panel-title">Clinical Note</h2>
          <p className="ql-subtitle">
            No note draft yet. Complete the stub pipeline to generate one.
          </p>
        </section>
      )}
    </AppShell>
  );
}
