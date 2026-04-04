import "server-only";

/**
 * POST /api/jobs/[id]/upload
 *
 * Upload audio file bound to an existing job. The provider must own
 * the job (verified via org_id + created_by). The file is stored in
 * Supabase Storage at: audio/{orgId}/{sessionId}/{jobId}/{filename}
 *
 * After upload, audio_storage_path is set on the job row via the
 * service client. This keeps the path write server-side only.
 *
 * Constraints:
 *   - Job must exist and belong to the authenticated user
 *   - Job must be in queued or running state (not terminal)
 *   - audio_storage_path must not already be set (no overwrite)
 *   - File must be present and have an audio/* MIME type
 *   - Max size enforced by the storage bucket (50 MiB)
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { ErrorCodes } from "@/lib/errors/codes";
import { getMyJob } from "@/lib/jobs/queries";
import { uploadJobAudioForOrg } from "@/lib/storage/audio";
import { writeAuditLog } from "@/lib/audit";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { logError, withLogging } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);

export const POST = withLogging(async (
  request: NextRequest,
  ctx: RouteContext,
) => {
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

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "Expected multipart form data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file field" },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("audio/")) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.type}. Expected audio/*` },
      { status: 422 },
    );
  }

  // Magic bytes validation - verify actual file signature matches an
  // allowed audio format regardless of the client-supplied MIME type.
  const headerBytes = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(headerBytes);
  const isValidAudio =
    // WebM
    (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) ||
    // MP4 / M4A - "ftyp" at bytes 4-7
    (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) ||
    // OGG - "OggS"
    (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) ||
    // WAV - "RIFF"
    (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) ||
    // MP3 - sync word variants
    (b[0] === 0xff && (b[1] === 0xfb || b[1] === 0xf3 || b[1] === 0xf2)) ||
    // MP3 - ID3 tag
    (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) ||
    // FLAC - "fLaC"
    (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43);

  if (!isValidAudio) {
    return NextResponse.json(
      { error: "File content does not match a supported audio format" },
      { status: 422 },
    );
  }

  const { storagePath, error: uploadError } = await uploadJobAudioForOrg({
    orgId: user.orgId,
    sessionId: job.session_id,
    jobId: job.id,
    file,
  });

  if (uploadError || !storagePath) {
    logError({
      code: ErrorCodes.JOB_UPLOAD_FAILED,
      message: "Direct audio upload failed",
      cause: uploadError,
      jobId: job.id,
      sessionId: job.session_id,
      orgId: user.orgId,
      userId: user.userId,
    });

    return NextResponse.json(
      {
        error: {
          code: ErrorCodes.JOB_UPLOAD_FAILED,
          message: "Upload failed.",
        },
      },
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
    metadata: { file_size_bytes: file.size },
  });

  return NextResponse.json({
    job_id: job.id,
    audio_storage_path: storagePath,
  });
});
