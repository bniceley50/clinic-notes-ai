import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { processJob } from "@/lib/jobs/processor";
import { workerLimit, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const expectedToken = process.env.JOBS_RUNNER_TOKEN;
  const authorization = request.headers.get("authorization");
  const expectedHeader = expectedToken ? `Bearer ${expectedToken}` : null;

  if (!expectedHeader || authorization !== expectedHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await checkRateLimit(workerLimit, "worker:process");
  if (limited) return limited;

  const { id: jobId } = await ctx.params;
  const result = await processJob(jobId);

  if (result.success) {
    const status = result.alreadyRunning ? 202 : 200;
    return NextResponse.json(
      { job_id: jobId, status: "processing" },
      { status },
    );
  }

  return NextResponse.json(
    { job_id: jobId, error: result.error },
    { status: 500 },
  );
});
