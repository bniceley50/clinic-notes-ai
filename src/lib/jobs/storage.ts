import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export const AUDIO_BUCKET = "audio";

function isBucketAlreadyPresent(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("already exists") || normalized.includes("duplicate");
}

export async function ensureAudioBucket(): Promise<{ error: string | null }> {
  const db = createServiceClient();

  const { data: buckets, error: listError } = await db.storage.listBuckets();
  if (listError) {
    return { error: listError.message };
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === AUDIO_BUCKET);
  if (exists) {
    return { error: null };
  }

  const { error: createError } = await db.storage.createBucket(AUDIO_BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  });

  if (createError && !isBucketAlreadyPresent(createError.message)) {
    return { error: createError.message };
  }

  return { error: null };
}

export function buildAudioStoragePath(input: {
  orgId: string;
  sessionId: string;
  jobId: string;
}): string {
  return `audio/${input.orgId}/${input.sessionId}/${input.jobId}/recording.webm`;
}
