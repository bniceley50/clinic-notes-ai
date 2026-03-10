import { NextResponse, type NextRequest } from "next/server";
import { jobsRunnerToken } from "@/lib/config";
import { listQueuedJobs } from "@/lib/jobs/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") {
    return true;
  }

  const token = jobsRunnerToken();
  if (!token) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(request: NextRequest) {
  if (!jobsRunnerToken()) {
    return NextResponse.json(
      { error: "Runner endpoint not configured" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, null);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const queued = await listQueuedJobs();
  if (queued.error) {
    return NextResponse.json(
      { error: "Failed to load queued jobs" },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  const automationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  for (const job of queued.data) {
    const processUrl = new URL(`/api/jobs/${job.id}/process`, baseUrl).toString();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.JOBS_RUNNER_TOKEN ?? ""}`,
    };

    if (automationBypassSecret) {
      headers["x-vercel-protection-bypass"] = automationBypassSecret;
    }

    void fetch(processUrl, {
      method: "POST",
      headers,
    });
  }

  return NextResponse.json({
    processed: queued.data.length,
  });
}