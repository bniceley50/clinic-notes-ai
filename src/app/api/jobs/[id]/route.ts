import "server-only";

/**
 * GET /api/jobs/[id]
 *
 * Returns the authenticated user's job by ID. Used by the client
 * polling loop to refresh status, stage, progress, and error_message.
 *
 * Ownership is enforced server-side: org_id + created_by must match.
 */

import type { NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { jsonNoStore } from "@/lib/http/response";
import { serializeJobForClient } from "@/lib/jobs/serialize-job-for-client";
import { getMyJob } from "@/lib/jobs/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { id } = await ctx.params;
  const { data: job, error } = await getMyJob(result.user, id);

  if (error || !job) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  return jsonNoStore(serializeJobForClient(job));
});
