import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { writeAuditLog } from "@/lib/audit";
import { ErrorCodes } from "@/lib/errors/codes";
import { getMyJob, updateJobWorkerFieldsForOrg } from "@/lib/jobs/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { logError, withLogging } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

  const { id } = await ctx.params;
  const { data: job, error: jobError } = await getMyJob(result.user, id);

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (
    job.status === "complete" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return NextResponse.json(
      { error: "Job cannot be cancelled in its current state" },
      { status: 409 },
    );
  }

  const { data, error } = await updateJobWorkerFieldsForOrg(result.user.orgId, id, {
    status: "cancelled",
    stage: "cancelled",
    error_message: "Cancelled by user",
    claimed_at: null,
    lease_expires_at: null,
    run_token: null,
  });

  if (error || !data) {
    logError({
      code: ErrorCodes.JOB_CANCEL_FAILED,
      message: "Job cancellation failed",
      cause: error,
      jobId: id,
      sessionId: job.session_id,
      orgId: result.user.orgId,
      userId: result.user.userId,
    });

    return NextResponse.json(
      {
        error: {
          code: ErrorCodes.JOB_CANCEL_FAILED,
          message: "Unable to cancel job.",
        },
      },
      { status: 500 },
    );
  }

  void writeAuditLog({
    orgId: result.user.orgId,
    actorId: result.user.userId,
    sessionId: job.session_id,
    jobId: id,
    action: "job.cancelled",
    requestId: request.headers.get("x-vercel-id") ?? undefined,
  });

  return NextResponse.json({
    job: {
      id,
      status: "cancelled",
    },
  });
});
