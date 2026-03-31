import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

// TEMPORARY DIAGNOSTIC ROUTE — DELETE AFTER SMOKE TEST
// Purpose: verify server-side Sentry event delivery in production.
// Usage: GET /api/sentry-smoke?token=<JOBS_RUNNER_TOKEN>
// After hitting this route, check Sentry Issues for "server-sentry-smoke".
// If the issue appears, server-side delivery works and the cron check-in
// problem is isolated to captureCheckIn specifically.
// If nothing appears, server-side Sentry is still dark after instrumentation fix.
// Delete this file and route once the diagnostic is complete.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  // Guard: require JOBS_RUNNER_TOKEN so this is not publicly triggerable.
  const expected = process.env.JOBS_RUNNER_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = Sentry.captureException(
    new Error("server-sentry-smoke: production delivery test"),
  );

  const flushed = await Sentry.flush(3000);

  return NextResponse.json({
    eventId,
    flushed,
    dsn: process.env.SENTRY_DSN ? "set" : "missing",
    runtime: process.env.NEXT_RUNTIME ?? "unknown",
  });
}
