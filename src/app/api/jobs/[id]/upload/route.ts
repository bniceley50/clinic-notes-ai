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
import { getMyJob } from "@/lib/jobs/queries";
import { uploadAudioForJob } from "@/lib/storage/audio";

type RouteContext = { params: Promise<{ id: string }> };

const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);

export async function POST(request: NextRequest, ctx: RouteContext) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { storagePath, error: uploadError } = await uploadAudioForJob({
    orgId: user.orgId,
    sessionId: job.session_id,
    jobId: job.id,
    file,
  });

  if (uploadError || !storagePath) {
    return NextResponse.json(
      { error: uploadError ?? "Upload failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    job_id: job.id,
    audio_storage_path: storagePath,
  });
}
