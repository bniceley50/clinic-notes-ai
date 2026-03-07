import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export async function uploadTranscript(input: {
  orgId: string;
  sessionId: string;
  jobId: string;
  text: string;
}): Promise<{ storagePath: string | null; error: string | null }> {
  try {
    const db = createServiceClient();
    const bucket = process.env.TRANSCRIPT_BUCKET ?? "transcripts";
    const storagePath = `${input.orgId}/${input.sessionId}/${input.jobId}/transcript.txt`;

    const { error } = await db.storage.from(bucket).upload(
      storagePath,
      new Blob([input.text], { type: "text/plain;charset=utf-8" }),
      {
        contentType: "text/plain; charset=utf-8",
        upsert: true,
      },
    );

    if (error) {
      return { storagePath: null, error: error.message };
    }

    return { storagePath, error: null };
  } catch (error) {
    return {
      storagePath: null,
      error: error instanceof Error ? error.message : "Failed to upload transcript",
    };
  }
}
