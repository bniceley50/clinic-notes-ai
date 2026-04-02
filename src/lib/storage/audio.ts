import "server-only";

/**
 * Server-side audio upload to Supabase Storage.
 *
 * Uploads to: audio/{orgId}/{sessionId}/{jobId}/{filename}
 * Then writes audio_storage_path back to the job row.
 *
 * Uses the service role client to bypass storage RLS, but the
 * user-facing helpers below now enforce org/job path boundaries
 * before signing URLs or writing job rows.
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

const AUDIO_SIGNATURE_BYTES = 12;

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

type AudioStoragePathParts = {
  orgId: string;
  sessionId: string;
  jobId: string;
  fileName: string;
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

export function parseAudioStoragePath(
  storagePath: string,
): AudioStoragePathParts | null {
  const normalized = storagePath.trim().replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/");

  if (parts.length !== 4 || parts.some((part) => part.length === 0)) {
    return null;
  }

  const [orgId, sessionId, jobId, fileName] = parts;
  return { orgId, sessionId, jobId, fileName };
}

function isAudioStoragePathForOrg(storagePath: string, orgId: string): boolean {
  const parsed = parseAudioStoragePath(storagePath);
  return parsed?.orgId === orgId;
}

function isAudioStoragePathForJobContext(
  storagePath: string,
  input: Pick<UploadAudioInput, "orgId" | "sessionId" | "jobId">,
): boolean {
  const parsed = parseAudioStoragePath(storagePath);
  if (!parsed) {
    return false;
  }

  return (
    parsed.orgId === input.orgId &&
    parsed.sessionId === input.sessionId &&
    parsed.jobId === input.jobId
  );
}

export function hasValidAudioSignature(bytes: Uint8Array): boolean {
  return (
    (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) ||
    (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) ||
    (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) ||
    (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) ||
    (bytes[0] === 0xff && (bytes[1] === 0xfb || bytes[1] === 0xf3 || bytes[1] === 0xf2)) ||
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
  );
}

export async function createSignedAudioUploadForOrg(
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

export async function finalizeJobAudioUploadForOrg(input: {
  orgId: string;
  sessionId: string;
  jobId: string;
  storagePath: string;
}): Promise<UploadResult> {
  if (!isAudioStoragePathForJobContext(input.storagePath, input)) {
    return {
      storagePath: null,
      error: "Audio path does not match the job context",
    };
  }

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

  const { data: objectData, error: downloadError } = await db.storage
    .from(AUDIO_BUCKET)
    .download(input.storagePath);

  if (downloadError || !objectData) {
    await db.storage
      .from(AUDIO_BUCKET)
      .remove([input.storagePath])
      .catch(() => {});
    return {
      storagePath: null,
      error: downloadError?.message ?? "Uploaded audio could not be downloaded for verification",
    };
  }

  const signatureBytes = new Uint8Array(
    await objectData.slice(0, AUDIO_SIGNATURE_BYTES).arrayBuffer(),
  );

  if (!hasValidAudioSignature(signatureBytes)) {
    await db.storage
      .from(AUDIO_BUCKET)
      .remove([input.storagePath])
      .catch(() => {});
    return {
      storagePath: null,
      error: "Uploaded audio content does not match a supported format",
    };
  }

  const { error: updateError } = await db
    .from("jobs")
    .update({
      audio_storage_path: input.storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", input.orgId)
    .eq("session_id", input.sessionId)
    .eq("id", input.jobId);

  if (updateError) {
    return { storagePath: null, error: updateError.message };
  }

  return { storagePath: input.storagePath, error: null };
}

export async function getSignedAudioUrlForOrg(
  orgId: string,
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string> {
  if (!isAudioStoragePathForOrg(storagePath, orgId)) {
    throw new Error("Audio path does not belong to this org");
  }

  const db = createServiceClient();
  const { data, error } = await db.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to generate signed audio URL");
  }

  return data.signedUrl;
}

export async function uploadJobAudioForOrg(
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
    .eq("org_id", input.orgId)
    .eq("session_id", input.sessionId)
    .eq("id", input.jobId);

  if (updateError) {
    return { storagePath: null, error: updateError.message };
  }

  return { storagePath, error: null };
}
