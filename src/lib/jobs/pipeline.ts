import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { JobRow } from "./queries";
import {
  getJobById,
  updateJobWorkerFields,
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
  const job = await getJobById(jobId);
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

async function failJob(jobId: string, message: string): Promise<void> {
  await updateJobWorkerFields(jobId, {
    status: "failed",
    stage: "failed",
    error_message: message,
  });
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

    const started = await updateJobWorkerFields(jobId, {
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

    const transcriptUpdated = await updateJobWorkerFields(jobId, {
      stage: "transcribing",
      progress: 50,
      transcript_storage_path: transcriptPath,
    });

    if (transcriptUpdated.error || !transcriptUpdated.data) {
      throw new Error(
        transcriptUpdated.error ?? "Failed to update transcript progress",
      );
    }

    await delay(STUB_STAGE_DELAY_MS);
    const beforeDraft = await stopIfTerminal(jobId);
    if (beforeDraft.status === "cancelled") {
      return { jobId, status: "cancelled" };
    }

    const drafting = await updateJobWorkerFields(jobId, {
      stage: "drafting",
      progress: 75,
    });

    if (drafting.error || !drafting.data) {
      throw new Error(drafting.error ?? "Failed to move job into drafting");
    }

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

    const completed = await updateJobWorkerFields(jobId, {
      status: "complete",
      stage: "complete",
      progress: 100,
      draft_storage_path: draftPath,
    });

    if (completed.error || !completed.data) {
      throw new Error(completed.error ?? "Failed to complete job");
    }

    return { jobId, status: "completed" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stub pipeline failed";
    await failJob(jobId, message);
    return { jobId, status: "failed" };
  }
}
