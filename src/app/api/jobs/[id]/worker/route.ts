import "server-only";

/**
 * POST /api/jobs/[id]/worker
 *
 * Backend-only endpoint for the job runner to update worker-owned
 * fields: status, stage, progress, error_message, and storage paths.
 *
 * Gated by JOBS_RUNNER_TOKEN bearer auth. Browser/client code cannot
 * call this - only the worker process with the shared secret.
 *
 * Validates state transitions: status can only move forward through
 * the defined FSM, never backwards or to arbitrary values.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jobsRunnerToken } from "@/lib/config";
import { ErrorCodes } from "@/lib/errors/codes";
import {
  getGlobalJobById,
  updateJobWorkerFieldsForOrg,
} from "@/lib/jobs/queries";
import { workerLimit, checkRateLimit } from "@/lib/rate-limit";
import { logError, withLogging } from "@/lib/logger";
import { serializeJobForClient } from "@/lib/jobs/serialize-job-for-client";

type RouteContext = { params: Promise<{ id: string }> };

const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);

const VALID_TRANSITIONS: Record<string, string[]> = {
  queued: ["running", "failed", "cancelled"],
  running: ["complete", "failed", "cancelled"],
};

const VALID_STAGES = new Set([
  "queued",
  "transcribing",
  "drafting",
  "exporting",
  "complete",
  "failed",
  "cancelled",
]);

export const POST = withLogging(async (
  request: NextRequest,
  ctx: RouteContext,
) => {
  const token = jobsRunnerToken();
  if (!token) {
    return NextResponse.json(
      { error: "Worker endpoint not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await checkRateLimit(workerLimit, "worker:update");
  if (limited) return limited;

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = await getGlobalJobById(id);
  if (!current) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (TERMINAL_STATUSES.has(current.status)) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCodes.JOB_STATUS_CONFLICT,
          message: "Job is not in a processable state.",
        },
      },
      { status: 409 },
    );
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string") {
      return NextResponse.json(
        { error: "status must be a string" },
        { status: 400 },
      );
    }
    const allowed = VALID_TRANSITIONS[current.status];
    if (!allowed || !allowed.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Invalid transition: ${current.status} -> ${body.status}`,
        },
        { status: 422 },
      );
    }
  }

  if (body.stage !== undefined) {
    if (typeof body.stage !== "string" || !VALID_STAGES.has(body.stage)) {
      return NextResponse.json(
        { error: `Invalid stage: ${body.stage}` },
        { status: 422 },
      );
    }
  }

  if (body.progress !== undefined) {
    if (
      typeof body.progress !== "number" ||
      body.progress < 0 ||
      body.progress > 100
    ) {
      return NextResponse.json(
        { error: "progress must be 0-100" },
        { status: 422 },
      );
    }
  }

  const updates: Record<string, unknown> = {};
  const ALLOWED_FIELDS = [
    "status",
    "stage",
    "progress",
    "error_message",
    "audio_storage_path",
    "transcript_storage_path",
    "draft_storage_path",
    "attempt_count",
  ];
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const { data, error } = await updateJobWorkerFieldsForOrg(
    current.org_id,
    id,
    updates,
  );

  if (error || !data) {
    logError({
      code: ErrorCodes.JOB_PROCESS_FAILED,
      message: "Worker status update failed",
      cause: error,
      jobId: id,
      sessionId: current.session_id,
      orgId: current.org_id,
    });

    return NextResponse.json(
      {
        error: {
          code: ErrorCodes.JOB_PROCESS_FAILED,
          message: "Job processing failed.",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ job: serializeJobForClient(data) });
});
