import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export async function downloadAudioForJob(
  storagePath: string,
): Promise<{ data: Blob | null; error: string | null }> {
  try {
    const db = createServiceClient();
    const bucket = process.env.AUDIO_BUCKET ?? "audio";
    const { data, error } = await db.storage.from(bucket).download(storagePath);

    if (error || !data) {
      return { data: null, error: error?.message ?? "Failed to download audio" };
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to download audio",
    };
  }
}
