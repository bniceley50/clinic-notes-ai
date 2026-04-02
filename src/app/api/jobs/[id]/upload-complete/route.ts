import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMyJob } from "@/lib/jobs/queries";
import {
  buildAudioStoragePath,
  finalizeJobAudioUploadForOrg,
} from "@/lib/storage/audio";
import { writeAuditLog } from "@/lib/audit";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

type UploadCompleteBody = {
  fileName?: unknown;
  fileSizeBytes?: unknown;
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

  const body = (await request.json().catch(() => null)) as UploadCompleteBody | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const fileSizeBytes =
    typeof body?.fileSizeBytes === "number" && Number.isFinite(body.fileSizeBytes)
      ? body.fileSizeBytes
      : undefined;

  if (!fileName) {
    return NextResponse.json(
      { error: "fileName is required" },
      { status: 400 },
    );
  }

  const storagePath = buildAudioStoragePath({
    orgId: user.orgId,
    sessionId: job.session_id,
    jobId: job.id,
    fileName,
  });

  const { storagePath: savedPath, error } = await finalizeJobAudioUploadForOrg({
    orgId: user.orgId,
    sessionId: job.session_id,
    jobId: job.id,
    storagePath,
  });

  if (error || !savedPath) {
    return NextResponse.json(
      { error: error ?? "Upload failed" },
      { status: 500 },
    );
  }

  void writeAuditLog({
    orgId: user.orgId,
    actorId: user.userId,
    sessionId: job.session_id,
    jobId: job.id,
    action: "audio.uploaded",
    requestId: request.headers.get("x-vercel-id") ?? undefined,
    metadata: { file_size_bytes: fileSizeBytes ?? null },
  });

  return NextResponse.json({
    job_id: job.id,
    audio_storage_path: savedPath,
  });
});
