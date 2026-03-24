import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { writeAuditLog } from "@/lib/audit";
import { getMyJob, updateJobWorkerFields } from "@/lib/jobs/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withLogging(async (request: NextRequest, ctx: RouteContext) => {
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

  if (job.status === "complete" || job.status === "failed") {
    return NextResponse.json(
      { error: "Job cannot be cancelled in its current state" },
      { status: 409 },
    );
  }

  const { data, error } = await updateJobWorkerFields(id, {
    status: "failed",
    stage: "failed",
    error_message: "Cancelled by user",
    claimed_at: null,
    lease_expires_at: null,
    run_token: null,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Failed to cancel job" },
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
      status: "failed",
    },
  });
});