import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export const AUDIO_BUCKET = "audio";
export const TRANSCRIPTS_BUCKET = "transcripts";
export const DRAFTS_BUCKET = "drafts";

function isBucketAlreadyPresent(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("already exists") || normalized.includes("duplicate");
}

async function ensureBucket(
  bucketName: string,
): Promise<{ error: string | null }> {
  const db = createServiceClient();

  const { data: buckets, error: listError } = await db.storage.listBuckets();
  if (listError) {
    return { error: listError.message };
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === bucketName);
  if (exists) {
    return { error: null };
  }

  const { error: createError } = await db.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  });

  if (createError && !isBucketAlreadyPresent(createError.message)) {
    return { error: createError.message };
  }

  return { error: null };
}

export async function ensureAudioBucket(): Promise<{ error: string | null }> {
  return ensureBucket(AUDIO_BUCKET);
}

export async function ensureTranscriptsBucket(): Promise<{
  error: string | null;
}> {
  return ensureBucket(TRANSCRIPTS_BUCKET);
}

export async function ensureDraftsBucket(): Promise<{ error: string | null }> {
  return ensureBucket(DRAFTS_BUCKET);
}

export function buildAudioStoragePath(input: {
  orgId: string;
  sessionId: string;
  jobId: string;
}): string {
  return `audio/${input.orgId}/${input.sessionId}/${input.jobId}/recording.webm`;
}

export function buildTranscriptStoragePath(input: {
  orgId: string;
  sessionId: string;
  jobId: string;
}): string {
  return `transcripts/${input.orgId}/${input.sessionId}/${input.jobId}/transcript.txt`;
}

export function buildDraftStoragePath(input: {
  orgId: string;
  sessionId: string;
  jobId: string;
}): string {
  return `drafts/${input.orgId}/${input.sessionId}/${input.jobId}/note.md`;
}
