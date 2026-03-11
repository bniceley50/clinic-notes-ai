import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { getJobById, updateJobWorkerFields } from "@/lib/jobs/queries";
import { downloadAudioForJob } from "@/lib/storage/audio-download";
import { uploadTranscript } from "@/lib/storage/transcript";
import { transcribeAudioChunked } from "@/lib/ai/whisper";
import { generateNote } from "@/lib/ai/claude";
import { upsertTranscriptForJob } from "@/lib/clinical/queries";
import { writeAuditLog } from "@/lib/audit";

type ProcessResult = {
  success: boolean;
  error: string | null;
};

async function failJob(jobId: string, error: string): Promise<ProcessResult> {
  await updateJobWorkerFields(jobId, {
    status: "failed",
    stage: "failed",
    error_message: error,
  });
  return { success: false, error };
}

export async function processJob(jobId: string): Promise<ProcessResult> {
  try {
    const job = await getJobById(jobId);

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    if (job.status !== "queued") {
      return { success: false, error: "Job not in queued state" };
    }

    if (!job.audio_storage_path) {
      return { success: false, error: "No audio uploaded" };
    }

    const started = await updateJobWorkerFields(jobId, {
      status: "running",
      stage: "transcribing",
      progress: 10,
      error_message: null,
    });

    if (started.error || !started.data) {
      return await failJob(jobId, started.error ?? "Failed to start job");
    }

    const downloaded = await downloadAudioForJob(job.audio_storage_path);
    if (downloaded.error || !downloaded.data) {
      return await failJob(jobId, downloaded.error ?? "Failed to download audio");
    }

    void writeAuditLog({
      orgId: job.org_id,
      actorId: job.created_by,
      sessionId: job.session_id,
      jobId,
      action: "audio.sent_to_vendor",
      vendor: "openai",
    });

    const transcription = await transcribeAudioChunked(
      downloaded.data,
      "recording.webm",
      async (chunkIndex, totalChunks) => {
        const progress = Math.round(10 + (chunkIndex / totalChunks) * 38);
        await updateJobWorkerFields(jobId, {
          stage: "transcribing",
          progress,
        });
      },
    );
    if (transcription.error || !transcription.text) {
      return await failJob(jobId, transcription.error ?? "Failed to transcribe audio");
    }

    const generating = await updateJobWorkerFields(jobId, {
      stage: "drafting",
      progress: 50,
    });

    if (generating.error || !generating.data) {
      return await failJob(jobId, generating.error ?? "Failed to update job progress");
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

    await upsertTranscriptForJob({
      sessionId: job.session_id,
      orgId: job.org_id,
      jobId,
      content: transcription.text,
      durationSeconds: 0,
      wordCount: transcription.text.trim().split(/\s+/).filter(Boolean).length,
    });

    void writeAuditLog({
      orgId: job.org_id,
      actorId: job.created_by,
      sessionId: job.session_id,
      jobId,
      action: "transcript.sent_to_vendor",
      vendor: "anthropic",
    });

    const noteResult = await generateNote({
      transcript: transcription.text,
      noteType: job.note_type,
    });

    if (noteResult.error || !noteResult.content) {
      return await failJob(jobId, noteResult.error ?? "Failed to generate note");
    }

    const saving = await updateJobWorkerFields(jobId, {
      stage: "drafting",
      progress: 80,
    });

    if (saving.error || !saving.data) {
      return await failJob(jobId, saving.error ?? "Failed to update save progress");
    }

    const db = createServiceClient();
    const { error: noteError } = await db.from("notes").insert({
      session_id: job.session_id,
      org_id: job.org_id,
      created_by: job.created_by,
      job_id: jobId,
      note_type: job.note_type,
      content: noteResult.content,
    });

    if (noteError) {
      return await failJob(jobId, noteError.message);
    }

    const completed = await updateJobWorkerFields(jobId, {
      status: "complete",
      stage: "complete",
      progress: 100,
      transcript_storage_path: transcriptStoragePath,
    });

    if (completed.error || !completed.data) {
      return await failJob(jobId, completed.error ?? "Failed to complete job");
    }

    return { success: true, error: null };
  } catch (error) {
    return await failJob(
      jobId,
      error instanceof Error ? error.message : "Job processing failed",
    );
  }
}