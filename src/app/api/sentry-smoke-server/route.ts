import "server-only";

import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { withLogging } from "@/lib/logger";

export const POST = withLogging(async (request: NextRequest) => {
  const expectedToken = process.env.JOBS_RUNNER_TOKEN;
  const authorization = request.headers.get("authorization");
  const expectedHeader = expectedToken ? `Bearer ${expectedToken}` : null;

  if (!expectedHeader || authorization !== expectedHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = Sentry.captureException(new Error("sentry-smoke-server"));
  const flushed = await Sentry.flush(5000);

  return NextResponse.json(
    {
      event_id: eventId,
      flushed,
    },
    { status: 200 },
  );
});
