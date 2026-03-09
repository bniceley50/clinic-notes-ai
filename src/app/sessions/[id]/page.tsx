import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";
import { getJobsForSession } from "@/lib/jobs/queries";
import {
  getLatestNoteForSession,
  getLatestTranscriptForSession,
} from "@/lib/clinical/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { CreateJobForm } from "@/components/jobs/CreateJobForm";
import { JobStatusPanel } from "@/components/jobs/JobStatusPanel";
import { NoteWorkspace } from "@/components/session/NoteWorkspace";
import { TranscriptViewer } from "@/components/session/TranscriptViewer";
import { AppShell } from "@/components/layout/AppShell";

type Props = {
  params: Promise<{ id: string }>;
};

type ConsentRow = {
  hipaa_consent: boolean;
  part2_applicable: boolean;
  part2_consent: boolean | null;
  created_at: string;
};

const SESSION_STATUS_CHIP: Record<string, string> = {
  active: "chip-running",
  completed: "chip-complete",
  archived: "chip-cancelled",
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

  let consent: ConsentRow | null = null;
  try {
    const db = createServiceClient();
    const { data: consentRow } = await db
      .from("session_consents")
      .select("hipaa_consent, part2_applicable, part2_consent, created_at")
      .eq("session_id", session.id)
      .eq("org_id", user.orgId)
      .limit(1)
      .maybeSingle();

    consent = (consentRow ?? null) as ConsentRow | null;
  } catch {
    consent = null;
  }

  const { data: jobs } = await getJobsForSession(user, id);
  const [noteResult, transcriptResult] = await Promise.all([
    getLatestNoteForSession(user, id),
    getLatestTranscriptForSession(user, id),
  ]);
  const note = noteResult.data;
  const transcript = transcriptResult.data;
  const hasActiveJob = jobs.some(
    (j) => j.status === "queued" || j.status === "running",
  );
  const hasConsent = consent?.hipaa_consent === true;

  return (
    <AppShell
      user={{
        displayName: user.profile.display_name,
        orgName: user.org.name,
        role: user.role,
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/sessions"
          className="text-xs font-medium no-underline"
          style={{ color: "#517AB7" }}
        >
          All Sessions
        </Link>
        <span
          className={`inline-block rounded-[2px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            SESSION_STATUS_CHIP[session.status] ?? "chip-cancelled"
          }`}
        >
          {session.status}
        </span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "300px 1fr" }}>
        <div className="space-y-4">
          <div className="card-ql overflow-hidden">
            <div
              className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Session
            </div>
            <table>
              <tbody>
                <tr>
                  <td className="w-28 text-xs font-semibold" style={{ color: "#517AB7" }}>
                    Patient
                  </td>
                  <td className="text-xs font-semibold" style={{ color: "#0B1215" }}>
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

          <div className="card-ql overflow-hidden">
            <div
              className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Consent Status
            </div>
            <div className="p-3 text-xs" style={{ color: hasConsent ? "#2F6F44" : "#8A4B08" }}>
              <p className="font-semibold">
                {hasConsent
                  ? consent?.part2_applicable && consent.part2_consent
                    ? "HIPAA + 42 CFR Part 2 consent recorded"
                    : "Consent recorded"
                  : "Consent not yet recorded"}
              </p>
              <p className="mt-1" style={{ color: hasConsent ? "#2F6F44" : "#8A4B08" }}>
                {hasConsent && consent
                  ? `Recorded ${new Date(consent.created_at).toLocaleString()}`
                  : "Record patient consent before starting a job."}
              </p>
            </div>
          </div>

          <div className="card-ql overflow-hidden">
            <div
              className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Generate Note
            </div>
            <div className="p-3">
              <CreateJobForm
                sessionId={session.id}
                hasActiveJob={hasActiveJob}
                hasConsent={hasConsent}
              />
            </div>
          </div>

          <div className="card-ql overflow-hidden">
            <div
              className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
            >
              Job History
            </div>
            <div className="p-3">
              <JobStatusPanel initialJobs={jobs} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {transcript && <TranscriptViewer transcript={transcript.content} />}

          {note ? (
            <NoteWorkspace
              sessionId={session.id}
              noteId={note.id}
              noteType={note.note_type}
              sessionType={session.session_type ?? "general"}
              sessionCreatedAt={session.created_at}
              sessionDate={new Date(session.created_at).toLocaleDateString()}
              patientLabel={session.patient_label ?? "Untitled"}
              providerName={user.profile.display_name}
              initialContent={note.content}
              initialUpdatedAt={note.updated_at}
            />
          ) : (
            <div className="card-ql p-6 text-center text-sm" style={{ color: "#777777" }}>
              No note generated yet. Upload audio to generate a note.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}