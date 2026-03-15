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

const AUDIO_BUCKET = "audio";
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
]);

type UploadAudioInput = {
  orgId: string;
  sessionId: string;
  jobId: string;
  file: File;
};

type SignedUploadInput = {
  orgId: string;
  sessionId: string;
  jobId: string;
  fileName: string;
  contentType: string;
};

type UploadResult = {
  storagePath: string | null;
  error: string | null;
};

export function sanitizeFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "webm";
  return `recording.${ext}`;
}

export function buildAudioStoragePath(input: {
  orgId: string;
  sessionId: string;
  jobId: string;
  fileName: string;
}): string {
  const filename = sanitizeFilename(input.fileName);
  return `${input.orgId}/${input.sessionId}/${input.jobId}/${filename}`;
}

export function isAllowedAudioMimeType(contentType: string): boolean {
  return ALLOWED_AUDIO_MIME_TYPES.has(contentType);
}

export async function createSignedAudioUpload(
  input: SignedUploadInput,
): Promise<{ path: string | null; token: string | null; error: string | null }> {
  if (!isAllowedAudioMimeType(input.contentType)) {
    return { path: null, token: null, error: "Unsupported audio content type" };
  }

  const db = createServiceClient();
  const storagePath = buildAudioStoragePath(input);
  const { data, error } = await db.storage
    .from(AUDIO_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.token) {
    return {
      path: null,
      token: null,
      error: error?.message ?? "Failed to create signed upload URL",
    };
  }

  return { path: storagePath, token: data.token, error: null };
}

export async function finalizeAudioUploadForJob(input: {
  jobId: string;
  storagePath: string;
}): Promise<UploadResult> {
  const db = createServiceClient();

  const { data: objectInfo, error: infoError } = await db.storage
    .from(AUDIO_BUCKET)
    .info(input.storagePath);

  if (infoError || !objectInfo) {
    return {
      storagePath: null,
      error: infoError?.message ?? "Uploaded audio could not be verified",
    };
  }

  const { error: updateError } = await db
    .from("jobs")
    .update({
      audio_storage_path: input.storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId);

  if (updateError) {
    return { storagePath: null, error: updateError.message };
  }

  return { storagePath: input.storagePath, error: null };
}

export async function createSignedAudioDownloadUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<{ url: string | null; error: string | null }> {
  const db = createServiceClient();
  const { data, error } = await db.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return {
      url: null,
      error: error?.message ?? "Failed to create signed audio URL",
    };
  }

  return { url: data.signedUrl, error: null };
}

export async function uploadAudioForJob(
  input: UploadAudioInput,
): Promise<UploadResult> {
  const db = createServiceClient();
  const storagePath = buildAudioStoragePath({
    orgId: input.orgId,
    sessionId: input.sessionId,
    jobId: input.jobId,
    fileName: input.file.name,
  });

  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await db.storage
    .from(AUDIO_BUCKET)
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
