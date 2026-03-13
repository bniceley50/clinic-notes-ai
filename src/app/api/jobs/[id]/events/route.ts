import { type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMyJob } from "@/lib/jobs/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const TERMINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeJob(job: Awaited<ReturnType<typeof getMyJob>>["data"]) {
  if (!job) return null;

  return {
    id: job.id,
    session_id: job.session_id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    note_type: job.note_type,
    attempt_count: job.attempt_count,
    error_message: job.error_message,
    audio_storage_path: job.audio_storage_path,
    transcript_storage_path: job.transcript_storage_path,
    draft_storage_path: job.draft_storage_path,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return new Response("Unauthorized", { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { id } = await ctx.params;
  const initial = await getMyJob(result.user, id);

  if (initial.error || !initial.data) {
    return new Response("Not found", { status: 404 });
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

      const fail = (message: string) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`),
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
        fail(error instanceof Error ? error.message : "Stream failed");
      });

      interval = setInterval(() => {
        void pushLatest().catch((error) => {
          fail(error instanceof Error ? error.message : "Stream failed");
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