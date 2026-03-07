import "server-only";

/**
 * Server-side audio upload to Supabase Storage.
 *
 * Uploads to: audio/{orgId}/{sessionId}/{jobId}/{filename}
 * Then writes audio_storage_path back to the job row.
 *
 * Uses the service role client to bypass storage RLS (the API
 * route already verified ownership before calling this).
 */

import { createServiceClient } from "@/lib/supabase/server";

type UploadAudioInput = {
  orgId: string;
  sessionId: string;
  jobId: string;
  file: File;
};

type UploadResult = {
  storagePath: string | null;
  error: string | null;
};

function sanitizeFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "webm";
  return `recording.${ext}`;
}

export async function uploadAudioForJob(
  input: UploadAudioInput,
): Promise<UploadResult> {
  const db = createServiceClient();

  const filename = sanitizeFilename(input.file.name);
  const storagePath = `${input.orgId}/${input.sessionId}/${input.jobId}/${filename}`;

  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await db.storage
    .from("audio")
    .upload(storagePath, buffer, {
      contentType: input.file.type,
      upsert: false,
    });

  if (uploadError) {
    return { storagePath: null, error: uploadError.message };
  }

  const { error: updateError } = await db
    .from("jobs")
    .update({
      audio_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId);

  if (updateError) {
    return { storagePath: null, error: updateError.message };
  }

  return { storagePath, error: null };
}
