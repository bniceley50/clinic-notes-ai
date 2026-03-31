import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { jobsRunnerToken } from "@/lib/config";
import {
  listExpiredRunningLeasedJobs,
  listQueuedJobs,
  requeueStaleLeasedJob,
} from "@/lib/jobs/queries";
import { cleanupSoftDeletedArtifacts } from "@/lib/storage/cleanup";
import { workerLimit, checkRateLimit } from "@/lib/rate-limit";
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
  // Runner heartbeat — tells Sentry the cron executed successfully.
  // Auto-creates the monitor on first check-in via monitorConfig and reports
  // every terminal path so cron auth/config/runtime failures are visible.
  const checkInId = Sentry.captureCheckIn(
    {
      monitorSlug: "jobs-runner",
      status: "in_progress",
    },
    {
      schedule: {
        type: "crontab",
        value: "* * * * *",
      },
      checkinMargin: 2,
      maxRuntime: 1,
      timezone: "UTC",
    },
  );

  console.log(
    "[runner] sentry client=",
    Sentry.getClient() ? "initialized" : "NOT INITIALIZED",
  ); // TEMPORARY

  const finishCheckIn = async (status: "ok" | "error") => {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "jobs-runner",
      status,
    });
    await Sentry.flush(2000);
  };

  const respondWithCheckIn = async (
    response: Response,
    status: "ok" | "error",
  ) => {
    await finishCheckIn(status);
    return response;
  };

  if (!jobsRunnerToken()) {
    return await respondWithCheckIn(
      NextResponse.json(
        { error: "Runner endpoint not configured" },
        { status: 503 },
      ),
      "error",
    );
  }

  const authorization = getAuthorizationResult(request);
  if (!authorization.ok) {
    return await respondWithCheckIn(
      NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      ),
      "error",
    );
  }

  const limited = await checkRateLimit(workerLimit, "worker:runner");
  if (limited) {
    return await respondWithCheckIn(limited, "error");
  }

  try {
    const queued = await listQueuedJobs();
    if (queued.error) {
      return await respondWithCheckIn(
        NextResponse.json(
          { error: "Failed to load queued jobs" },
          { status: 500 },
        ),
        "error",
      );
    }

    const expired = await listExpiredRunningLeasedJobs();
    if (expired.error) {
      return await respondWithCheckIn(
        NextResponse.json(
          { error: "Failed to load expired running jobs" },
          { status: 500 },
        ),
        "error",
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

    return await respondWithCheckIn(
      NextResponse.json({
        processed: queued.data.length,
      }),
      "ok",
    );
  } catch (error) {
    await finishCheckIn("error");
    throw error;
  }
});
