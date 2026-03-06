import "server-only";

/**
 * GET /api/jobs/[id]
 *
 * Returns the authenticated user's job by ID. Used by the client
 * polling loop to refresh status, stage, progress, and error_message.
 *
 * Ownership is enforced server-side: org_id + created_by must match.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { cancelMyJob, getMyJob } from "@/lib/jobs/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { data: job, error } = await getMyJob(result.user, id);

  if (error || !job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    session_id: job.session_id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    note_type: job.note_type,
    attempt_count: job.attempt_count,
    error_message: job.error_message,
    audio_storage_path: job.audio_storage_path,
    transcript_storage_path: job.transcript_storage_path,
    draft_storage_path: job.draft_storage_path,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { data, error } = await cancelMyJob(result.user, id);

  if (error) {
    const status =
      error.includes("Job not found") || error.includes("row") ? 404 : 409;
    return NextResponse.json({ error }, { status });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ job: data });
}
