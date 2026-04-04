import { type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { ErrorCodes } from "@/lib/errors/codes";
import { getMyJob } from "@/lib/jobs/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { serializeJobForClient } from "@/lib/jobs/serialize-job-for-client";
import { logError, withLogging } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeJob(job: Awaited<ReturnType<typeof getMyJob>>["data"]) {
  return job ? serializeJobForClient(job) : null;
}

export const GET = withLogging(async (
  request: NextRequest,
  ctx: RouteContext,
) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return Response.json(
      {
        error: {
          code: ErrorCodes.JOB_EVENTS_STREAM_ERROR,
          message: "Unauthorized",
        },
      },
      { status: 401 },
    );
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { id } = await ctx.params;
  const initial = await getMyJob(result.user, id);

  if (initial.error || !initial.data) {
    return Response.json(
      {
        error: {
          code: ErrorCodes.JOB_EVENTS_STREAM_ERROR,
          message: "Not found",
        },
      },
      { status: 404 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let lastPayload = "";
      let interval: NodeJS.Timeout | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) {
          clearInterval(interval);
        }
        controller.close();
      };

      const send = (payload: ReturnType<typeof serializeJob>) => {
        if (closed || !payload) return;
        const serialized = JSON.stringify(payload);
        if (serialized === lastPayload) return;
        lastPayload = serialized;
        controller.enqueue(
          encoder.encode(`event: job\ndata: ${serialized}\n\n`),
        );
        if (TERMINAL_STATUSES.has(payload.status)) {
          close();
        }
      };

      const fail = (cause: unknown) => {
        if (closed) return;
        logError({
          code: ErrorCodes.JOB_EVENTS_STREAM_ERROR,
          message: "SSE stream error",
          cause,
          jobId: id,
          orgId: result.user.orgId,
          userId: result.user.userId,
          sessionId: initial.data?.session_id,
        });
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ type: "error", code: ErrorCodes.JOB_EVENTS_STREAM_ERROR })}\n\n`,
          ),
        );
        close();
      };

      const pushLatest = async () => {
        const latest = await getMyJob(result.user, id);
        if (latest.error || !latest.data) {
          fail(latest.error ?? "Job not found");
          return;
        }
        send(serializeJob(latest.data));
      };

      request.signal.addEventListener("abort", close);
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      void pushLatest().catch((error) => {
        fail(error);
      });

      interval = setInterval(() => {
        void pushLatest().catch((error) => {
          fail(error);
        });
      }, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
