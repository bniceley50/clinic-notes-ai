import { NextResponse, type NextRequest } from "next/server";
import { jobsRunnerToken } from "@/lib/config";
import {
  listExpiredRunningLeasedJobs,
  listQueuedJobs,
  requeueStaleLeasedJob,
} from "@/lib/jobs/queries";
import { cleanupSoftDeletedArtifacts } from "@/lib/storage/cleanup";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

function getAuthorizationResult(request: NextRequest): {
  ok: boolean;
  status: number;
  error: string;
} {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[runner] CRON_SECRET is not configured");
    return { ok: false, status: 500, error: "Server misconfiguration" };
  }

  if (request.headers.get("x-vercel-cron") === "1") {
    if (authHeader === `Bearer ${cronSecret}`) {
      return { ok: true, status: 200, error: "" };
    }

    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const token = jobsRunnerToken();
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (authHeader === `Bearer ${token}`) {
    return { ok: true, status: 200, error: "" };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}

export const GET = withLogging(async (request: NextRequest) => {
  if (!jobsRunnerToken()) {
    return NextResponse.json(
      { error: "Runner endpoint not configured" },
      { status: 503 },
    );
  }

  const authorization = getAuthorizationResult(request);
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
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

  const expired = await listExpiredRunningLeasedJobs();
  if (expired.error) {
    return NextResponse.json(
      { error: "Failed to load expired running jobs" },
      { status: 500 },
    );
  }

  for (const job of expired.data) {
    await requeueStaleLeasedJob(job.id);
  }
  const runnerToken = jobsRunnerToken();

  for (const job of queued.data) {
    const processUrl = new URL(`/api/jobs/${job.id}/process`, request.url).toString();

    void fetch(processUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runnerToken ?? ""}`,
      },
    });
  }

  // Artifact cleanup phase — runs after job maintenance, non-blocking.
  // Failures are logged but do not fail the runner response.
  void cleanupSoftDeletedArtifacts().then(({ cleaned, error }) => {
    if (error) {
      console.error("[runner] artifact cleanup error:", error);
    } else if (cleaned > 0) {
      console.log(`[runner] cleaned ${cleaned} soft-deleted job artifact set(s)`);
    }
  });

  return NextResponse.json({
    processed: queued.data.length,
  });
});
