import { NextResponse, type NextRequest } from "next/server";
import { jobsRunnerToken } from "@/lib/config";
import { listQueuedJobs } from "@/lib/jobs/queries";
import { runStubPipeline } from "@/lib/jobs/pipeline";

function isAuthorized(request: NextRequest): boolean {
  const token = jobsRunnerToken();
  if (!token) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  if (!jobsRunnerToken()) {
    return NextResponse.json(
      { error: "Runner endpoint not configured" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queued = await listQueuedJobs();
  if (queued.error) {
    return NextResponse.json(
      { error: "Failed to load queued jobs" },
      { status: 500 },
    );
  }

  const results = [];
  for (const job of queued.data) {
    const result = await runStubPipeline(job.id);
    results.push(result);
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
