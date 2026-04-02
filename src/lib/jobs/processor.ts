import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import {
  claimJobForProcessingGlobally,
  getGlobalJobById,
  updateClaimedJobWorkerFieldsForOrg,
  type JobNoteType,
  type JobRow,
} from "@/lib/jobs/queries";
import { downloadAudioForJob } from "@/lib/storage/audio-download";
import { uploadTranscript } from "@/lib/storage/transcript";
import { transcribeAudioChunked } from "@/lib/ai/whisper";
import { generateNote } from "@/lib/ai/claude";
import { upsertNoteForJob, upsertTranscriptForJob } from "@/lib/clinical/queries";
import { writeAuditLog } from "@/lib/audit";

type ProcessResult = {
  success: boolean;
  error: string | null;
  alreadyRunning?: boolean;
};

type TranscriptLookupRow = {
  content: string;
};

const PROCESSING_LEASE_SECONDS = 300;
const MAX_PROCESS_ATTEMPTS = 3;
const CLAIM_LOST_ERROR = "Job claim lost";

function clearedClaimFields() {
  return {
    claimed_at: null,
    lease_expires_at: null,
    run_token: null,
  };
}

async function updateClaimedJob(
  orgId: string,
  jobId: string,
  runToken: string,
  fields: Record<string, unknown>,
): Promise<{ data: JobRow | null; error: string | null }> {
  const updated = await updateClaimedJobWorkerFieldsForOrg(
    orgId,
    jobId,
    runToken,
    fields,
  );
  if (updated.error) {
    return { data: null, error: updated.error };
  }

  if (!updated.data) {
    return { data: null, error: CLAIM_LOST_ERROR };
  }

  return updated;
}

async function failJob(job: JobRow, runToken: string, error: string): Promise<ProcessResult> {
  const terminal = job.attempt_count >= MAX_PROCESS_ATTEMPTS;
  const failed = await updateClaimedJob(job.org_id, job.id, runToken, {
    ...(terminal
      ? {
          status: "failed",
          stage: "failed",
          error_message: error,
        }
      : {
          status: "queued",
          stage: "queued",
          progress: 0,
          error_message: error,
        }),
    ...clearedClaimFields(),
  });

  if (failed.error) {
    return { success: false, error: failed.error };
  }

  return { success: false, error };
}

export async function generateNoteForJob(jobId: string): Promise<ProcessResult> {
  try {
    const job = await getGlobalJobById(jobId);

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    const db = createServiceClient();
    const { data: transcriptRow, error: transcriptError } = await db
      .from("transcripts")
      .select("content")
      .eq("job_id", jobId)
      .eq("session_id", job.session_id)
      .eq("org_id", job.org_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (transcriptError) {
      return { success: false, error: transcriptError.message };
    }

    if (!(transcriptRow as TranscriptLookupRow | null)?.content) {
      return { success: false, error: "Transcript not found for job" };
    }

    const transcript = (transcriptRow as TranscriptLookupRow).content;

    void writeAuditLog({
      orgId: job.org_id,
      actorId: job.created_by,
      sessionId: job.session_id,
      jobId,
      action: "transcript.sent_to_vendor",
      vendor: "anthropic",
    });

    const noteResult = await generateNote({
      transcript,
      noteType: job.note_type,
    });

    if (noteResult.error || !noteResult.content) {
      return { success: false, error: noteResult.error ?? "Failed to generate note" };
    }

    const saved = await upsertNoteForJob({
      sessionId: job.session_id,
      orgId: job.org_id,
      jobId,
      createdBy: job.created_by,
      noteType: job.note_type as JobNoteType,
      content: noteResult.content,
    });

    if (saved.error || !saved.data) {
      return { success: false, error: saved.error ?? "Failed to save note" };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate note",
    };
  }
}

export async function processJob(jobId: string): Promise<ProcessResult> {
  let claimedJob: JobRow | null = null;
  let runToken: string | null = null;

  try {
    const claimed = await claimJobForProcessingGlobally(
      jobId,
      PROCESSING_LEASE_SECONDS,
    );
    if (claimed.error) {
      return { success: false, error: claimed.error };
    }

    if (!claimed.data?.run_token) {
      return { success: true, error: null, alreadyRunning: true };
    }

    const job = claimed.data;
    const claimedRunToken = claimed.data.run_token;
    claimedJob = job;
    runToken = claimedRunToken;

    if (!job.audio_storage_path) {
      return await failJob(job, claimedRunToken, "No audio uploaded");
    }

    const downloaded = await downloadAudioForJob(job.audio_storage_path);
    if (downloaded.error || !downloaded.data) {
      return await failJob(job, claimedRunToken, downloaded.error ?? "Failed to download audio");
    }

    void writeAuditLog({
      orgId: job.org_id,
      actorId: job.created_by,
      sessionId: job.session_id,
      jobId,
      action: "audio.sent_to_vendor",
      vendor: "openai",
    });

    const ext = job.audio_storage_path.split(".").pop()?.toLowerCase() || "webm";
    const transcriptionFilename = `recording.${ext}`;

    const transcription = await transcribeAudioChunked(
      downloaded.data,
      transcriptionFilename,
      async (chunkIndex, totalChunks) => {
        const progress = Math.round(10 + (chunkIndex / totalChunks) * 38);
        const updated = await updateClaimedJob(job.org_id, jobId, claimedRunToken, {
          stage: "transcribing",
          progress,
        });
        if (updated.error) {
          throw new Error(updated.error);
        }
      },
    );
    if (transcription.error || !transcription.text) {
      return await failJob(
        job,
        claimedRunToken,
        transcription.error ?? "Failed to transcribe audio",
      );
    }

    let transcriptStoragePath: string | null = null;

    const transcriptUpload = await uploadTranscript({
      orgId: job.org_id,
      sessionId: job.session_id,
      jobId,
      text: transcription.text,
    });

    if (!transcriptUpload.error) {
      transcriptStoragePath = transcriptUpload.storagePath;
    }

    const transcriptRow = await upsertTranscriptForJob({
      sessionId: job.session_id,
      orgId: job.org_id,
      jobId,
      content: transcription.text,
      durationSeconds: 0,
      wordCount: transcription.text.trim().split(/\s+/).filter(Boolean).length,
    });

    if (transcriptRow.error || !transcriptRow.data) {
      return await failJob(job, claimedRunToken, transcriptRow.error ?? "Failed to store transcript");
    }

    const completed = await updateClaimedJob(job.org_id, jobId, claimedRunToken, {
      status: "complete",
      stage: "complete",
      progress: 100,
      transcript_storage_path: transcriptStoragePath,
      ...clearedClaimFields(),
    });

    if (completed.error) {
      return completed.error === CLAIM_LOST_ERROR
        ? { success: false, error: CLAIM_LOST_ERROR }
        : await failJob(job, claimedRunToken, completed.error ?? "Failed to complete job");
    }

    // NOTE GENERATION: disabled in the default pipeline.
    // Optional note generation remains available via generateNoteForJob(jobId).

    return { success: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job processing failed";
    if (!claimedJob || !runToken) {
      return { success: false, error: message };
    }

    if (message === CLAIM_LOST_ERROR) {
      return { success: false, error: CLAIM_LOST_ERROR };
    }

    return await failJob(claimedJob, runToken, message);
  }
}
