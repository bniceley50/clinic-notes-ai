import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { createServiceClient } from "@/lib/supabase/server";
import { getMyJob, setMyJobAudioPath } from "@/lib/jobs/queries";
import {
  buildAudioStoragePath,
  ensureAudioBucket,
  AUDIO_BUCKET,
} from "@/lib/jobs/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const current = await getMyJob(result.user, id);

  if (current.error || !current.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (current.data.status === "cancelled") {
    return NextResponse.json(
      { error: "Cancelled jobs cannot accept uploads" },
      { status: 409 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "A non-empty audio file is required" },
      { status: 400 },
    );
  }

  const bucket = await ensureAudioBucket();
  if (bucket.error) {
    return NextResponse.json(
      { error: "Failed to prepare audio bucket" },
      { status: 500 },
    );
  }

  const audioStoragePath = buildAudioStoragePath({
    orgId: result.user.orgId,
    sessionId: current.data.session_id,
    jobId: current.data.id,
  });

  const db = createServiceClient();
  const { error: uploadError } = await db.storage
    .from(AUDIO_BUCKET)
    .upload(audioStoragePath, file, {
      contentType: file.type || "audio/webm",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload audio" },
      { status: 500 },
    );
  }

  const updated = await setMyJobAudioPath(result.user, current.data.id, audioStoragePath);
  if (updated.error || !updated.data) {
    return NextResponse.json(
      { error: updated.error ?? "Failed to update job" },
      { status: 500 },
    );
  }

  return NextResponse.json({ job: updated.data });
}
