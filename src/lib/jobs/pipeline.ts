import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { JobRow } from "./queries";
import {
  getGlobalJobById,
  updateJobWorkerFieldsForOrg,
  type JobNoteType,
} from "./queries";
import {
  buildDraftStoragePath,
  buildTranscriptStoragePath,
  DRAFTS_BUCKET,
  ensureDraftsBucket,
  ensureTranscriptsBucket,
  TRANSCRIPTS_BUCKET,
} from "./storage";
import { buildStubNote, buildStubTranscript } from "./stubs";
import { upsertNoteForJob, upsertTranscriptForJob } from "@/lib/clinical/queries";
import { writeAuditLog } from "@/lib/audit";

const STUB_STAGE_DELAY_MS = 1_200;
const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);

type SessionSeed = {
  patientLabel: string;
  providerName: string;
  sessionType: string;
};

export type PipelineRunResult = {
  jobId: string;
  status: "completed" | "skipped" | "cancelled" | "failed";
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countWords(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

async function loadSeed(job: JobRow): Promise<SessionSeed> {
  const db = createServiceClient();

  const [sessionResult, profileResult] = await Promise.all([
    db
      .from("sessions")
      .select("patient_label, session_type")
      .eq("id", job.session_id)
      .eq("org_id", job.org_id)
      .is("deleted_at", null)
      .single(),
    db
      .from("profiles")
      .select("display_name")
      .eq("user_id", job.created_by)
      .eq("org_id", job.org_id)
      .single(),
  ]);

  if (sessionResult.error || !sessionResult.data) {
    throw new Error("Session not found for job pipeline");
  }

  if (profileResult.error || !profileResult.data) {
    throw new Error("Profile not found for job pipeline");
  }

  return {
    patientLabel: sessionResult.data.patient_label || "Patient A",
    providerName: profileResult.data.display_name,
    sessionType: sessionResult.data.session_type,
  };
}

async function readCurrentJob(jobId: string): Promise<JobRow> {
  const job = await getGlobalJobById(jobId);
  if (!job) {
    throw new Error("Job not found");
  }
  return job;
}

async function stopIfTerminal(jobId: string): Promise<JobRow> {
  const current = await readCurrentJob(jobId);
  if (TERMINAL_STATUSES.has(current.status)) {
    return current;
  }
  return current;
}

async function uploadTextArtifact(
  bucket: string,
  storagePath: string,
  content: string,
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.storage.from(bucket).upload(
    storagePath,
    new Blob([content], { type: "text/plain;charset=utf-8" }),
    {
      contentType: "text/plain; charset=utf-8",
      upsert: true,
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function failJob(job: JobRow, message: string): Promise<void> {
  await updateJobWorkerFieldsForOrg(job.org_id, job.id, {
    status: "failed",
    stage: "failed",
    error_message: message,
  });
}

export async function generateStubNoteForJob(jobId: string): Promise<PipelineRunResult> {
  try {
    const current = await readCurrentJob(jobId);
    const seed = await loadSeed(current);
    const noteContent = buildStubNote(
      current.note_type as JobNoteType,
      seed,
    );
    const draftPath = buildDraftStoragePath({
      orgId: current.org_id,
      sessionId: current.session_id,
      jobId,
    });

    const draftsBucket = await ensureDraftsBucket();
    if (draftsBucket.error) {
      throw new Error(draftsBucket.error);
    }

    void writeAuditLog({
      orgId: current.org_id,
      actorId: current.created_by,
      sessionId: current.session_id,
      jobId,
      action: "transcript.sent_to_vendor",
      vendor: "anthropic",
      metadata: { stub: true },
    });

    await uploadTextArtifact(DRAFTS_BUCKET, draftPath, noteContent);

    const noteRow = await upsertNoteForJob({
      sessionId: current.session_id,
      orgId: current.org_id,
      jobId,
      createdBy: current.created_by,
      noteType: current.note_type as JobNoteType,
      content: noteContent,
    });

    if (noteRow.error || !noteRow.data) {
      throw new Error(noteRow.error ?? "Failed to write note row");
    }

    await updateJobWorkerFieldsForOrg(current.org_id, jobId, {
      draft_storage_path: draftPath,
    });

    return { jobId, status: "completed" };
  } catch {
    return { jobId, status: "failed" };
  }
}

export async function runStubPipeline(jobId: string): Promise<PipelineRunResult> {
  const current = await readCurrentJob(jobId);

  if (current.status === "complete") {
    return { jobId, status: "skipped" };
  }

  if (current.status === "running") {
    return { jobId, status: "skipped" };
  }

  if (current.status === "cancelled") {
    return { jobId, status: "cancelled" };
  }

  try {
    const seed = await loadSeed(current);

    const started = await updateJobWorkerFieldsForOrg(current.org_id, jobId, {
      status: "running",
      stage: "transcribing",
      progress: 25,
      attempt_count: current.attempt_count + 1,
      error_message: null,
    });

    if (started.error || !started.data) {
      throw new Error(started.error ?? "Failed to start job");
    }

    await delay(STUB_STAGE_DELAY_MS);
    const afterStart = await stopIfTerminal(jobId);
    if (afterStart.status === "cancelled") {
      return { jobId, status: "cancelled" };
    }

    const transcriptContent = buildStubTranscript(seed);
    const transcriptPath = buildTranscriptStoragePath({
      orgId: current.org_id,
      sessionId: current.session_id,
      jobId,
    });

    const transcriptBucket = await ensureTranscriptsBucket();
    if (transcriptBucket.error) {
      throw new Error(transcriptBucket.error);
    }

    void writeAuditLog({
      orgId: current.org_id,
      actorId: current.created_by,
      sessionId: current.session_id,
      jobId,
      action: "audio.sent_to_vendor",
      vendor: "openai",
      metadata: { stub: true },
    });

    await uploadTextArtifact(
      TRANSCRIPTS_BUCKET,
      transcriptPath,
      transcriptContent,
    );

    const transcriptRow = await upsertTranscriptForJob({
      sessionId: current.session_id,
      orgId: current.org_id,
      jobId,
      content: transcriptContent,
      durationSeconds: 245,
      wordCount: countWords(transcriptContent),
    });

    if (transcriptRow.error || !transcriptRow.data) {
      throw new Error(transcriptRow.error ?? "Failed to write transcript row");
    }

    const completed = await updateJobWorkerFieldsForOrg(current.org_id, jobId, {
      status: "complete",
      stage: "complete",
      progress: 100,
      transcript_storage_path: transcriptPath,
    });

    if (completed.error || !completed.data) {
      throw new Error(completed.error ?? "Failed to complete job");
    }

    // NOTE GENERATION: disabled in the default stub pipeline.
    // Optional note generation remains available via generateStubNoteForJob(jobId).

    return { jobId, status: "completed" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stub pipeline failed";
    await failJob(current, message);
    return { jobId, status: "failed" };
  }
}
