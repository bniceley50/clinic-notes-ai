import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMyJob } from "@/lib/jobs/queries";
import { createSignedAudioUploadForOrg } from "@/lib/storage/audio";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

type UploadUrlBody = {
  fileName?: unknown;
  contentType?: unknown;
};

const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);

export const POST = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { user } = result;
  const { id: jobId } = await ctx.params;
  const { data: job, error: jobError } = await getMyJob(user, jobId);

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (TERMINAL_STATUSES.has(job.status)) {
    return NextResponse.json(
      { error: `Cannot upload to a ${job.status} job` },
      { status: 409 },
    );
  }

  if (job.audio_storage_path) {
    return NextResponse.json(
      { error: "Audio already uploaded for this job" },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as UploadUrlBody | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType.trim() : "";

  if (!fileName || !contentType) {
    return NextResponse.json(
      { error: "fileName and contentType are required" },
      { status: 400 },
    );
  }

  const { path, token, error } = await createSignedAudioUploadForOrg({
    orgId: user.orgId,
    sessionId: job.session_id,
    jobId: job.id,
    fileName,
    contentType,
  });

  if (error || !path || !token) {
    return NextResponse.json(
      { error: error ?? "Failed to create upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ path, token });
});
