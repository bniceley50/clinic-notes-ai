import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { processJob } from "@/lib/jobs/processor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, ctx: RouteContext) {
  const expectedToken = process.env.JOBS_RUNNER_TOKEN;
  const authorization = request.headers.get("authorization");
  const expectedHeader = expectedToken ? `Bearer ${expectedToken}` : null;

  if (!expectedHeader || authorization !== expectedHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await ctx.params;
  const result = await processJob(jobId);

  if (result.success) {
    return NextResponse.json({ job_id: jobId, status: "complete" });
  }

  return NextResponse.json(
    { job_id: jobId, error: result.error },
    { status: 500 },
  );
}
