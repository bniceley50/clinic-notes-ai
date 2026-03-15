import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { createServiceClient } from "@/lib/supabase/server";
import { createSignedAudioDownloadUrl } from "@/lib/storage/audio";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

type AudioJobRow = {
  id: string;
  created_by: string;
  audio_storage_path: string | null;
};

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { id: jobId } = await ctx.params;
  const db = createServiceClient();
  let query = db
    .from("jobs")
    .select("id, created_by, audio_storage_path")
    .eq("id", jobId)
    .eq("org_id", result.user.orgId);

  if (result.user.role !== "admin") {
    query = query.eq("created_by", result.user.userId);
  }

  const { data: job, error: jobError } = await query.maybeSingle();

  const audioJob = (job ?? null) as AudioJobRow | null;

  if (jobError || !audioJob) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!audioJob.audio_storage_path) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  const { url, error } = await createSignedAudioDownloadUrl(audioJob.audio_storage_path, 3600);

  if (error || !url) {
    return NextResponse.json(
      { error: error ?? "Failed to create audio URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url });
});
