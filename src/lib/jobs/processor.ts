import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { getJobById, updateJobWorkerFields, type JobNoteType } from "@/lib/jobs/queries";
import { downloadAudioForJob } from "@/lib/storage/audio-download";
import { uploadTranscript } from "@/lib/storage/transcript";
import { transcribeAudioChunked } from "@/lib/ai/whisper";
import { generateNote } from "@/lib/ai/claude";
import { upsertNoteForJob, upsertTranscriptForJob } from "@/lib/clinical/queries";
import { writeAuditLog } from "@/lib/audit";

type ProcessResult = {
  success: boolean;
  error: string | null;
};

type TranscriptLookupRow = {
  content: string;
};

async function failJob(jobId: string, error: string): Promise<ProcessResult> {
  await updateJobWorkerFields(jobId, {
    status: "failed",
    stage: "failed",
    error_message: error,
  });
  return { success: false, error };
}

export async function generateNoteForJob(jobId: string): Promise<ProcessResult> {
  try {
    const job = await getJobById(jobId);

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

    const ext = job.audio_storage_path.split(".").pop()?.toLowerCase() || "webm";
    const transcriptionFilename = `recording.${ext}`;

    const transcription = await transcribeAudioChunked(
      downloaded.data,
      transcriptionFilename,
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
      return await failJob(jobId, transcriptRow.error ?? "Failed to store transcript");
    }

    void writeAuditLog({
      orgId: job.org_id,
      actorId: job.created_by,
      sessionId: job.session_id,
      jobId,
      action: "transcript.sent_to_vendor",
      vendor: "anthropic",
    });

    const completed = await updateJobWorkerFields(jobId, {
      status: "complete",
      stage: "complete",
      progress: 100,
      transcript_storage_path: transcriptStoragePath,
    });

    if (completed.error || !completed.data) {
      return await failJob(jobId, completed.error ?? "Failed to complete job");
    }

    // NOTE GENERATION: disabled in the default pipeline.
    // Optional note generation remains available via generateNoteForJob(jobId).

    return { success: true, error: null };
  } catch (error) {
    return await failJob(
      jobId,
      error instanceof Error ? error.message : "Job processing failed",
    );
  }
}
