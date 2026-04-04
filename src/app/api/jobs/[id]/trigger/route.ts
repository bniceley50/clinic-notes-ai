import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMyJob } from "@/lib/jobs/queries";
import { writeAuditLog } from "@/lib/audit";
import { jobsRunnerToken } from "@/lib/config";
import { ErrorCodes, readErrorMessage } from "@/lib/errors/codes";
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

  const { id: jobId } = await ctx.params;
  const { data: job, error } = await getMyJob(result.user, jobId);

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const runnerToken = jobsRunnerToken();
  if (!runnerToken) {
    return NextResponse.json(
      { error: "Runner endpoint not configured" },
      { status: 503 },
    );
  }

  const processUrl = new URL(`/api/jobs/${jobId}/process`, request.url).toString();

  let processResponse: Response;

  try {
    processResponse = await fetch(processUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runnerToken}`,
      },
    });
  } catch (error) {
    logError({
      code: ErrorCodes.JOB_TRIGGER_FAILED,
      message: "Job trigger failed while calling the processor route",
      cause: error,
      jobId,
      sessionId: job.session_id,
      orgId: result.user.orgId,
      userId: result.user.userId,
    });

    return NextResponse.json(
      {
        error: {
          code: ErrorCodes.JOB_TRIGGER_FAILED,
          message: "Unable to trigger job.",
        },
      },
      { status: 500 },
    );
  }

  if (!processResponse.ok) {
    const payload = (await processResponse.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } | string }
      | null;

    logError({
      code: ErrorCodes.JOB_TRIGGER_FAILED,
      message: "Job trigger failed because the processor route returned an error",
      cause: payload,
      jobId,
      sessionId: job.session_id,
      orgId: result.user.orgId,
      userId: result.user.userId,
    });

    return NextResponse.json(
      {
        error: {
          code: ErrorCodes.JOB_TRIGGER_FAILED,
          message: readErrorMessage(payload) ?? "Unable to trigger job.",
        },
      },
      { status: 500 },
    );
  }

  void writeAuditLog({
    orgId: result.user.orgId,
    actorId: result.user.userId,
    jobId,
    action: "job.triggered",
    requestId: request.headers.get("x-vercel-id") ?? undefined,
  });

  return NextResponse.json({ job_id: jobId, status: "processing" }, { status: 202 });
});
