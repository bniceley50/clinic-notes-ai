import type { NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { ErrorCodes } from "@/lib/errors/codes";
import { jsonNoStore } from "@/lib/http/response";
import {
  getMySession,
  softDeleteSession,
  updateMySession,
} from "@/lib/sessions/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { logError, withLogging } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ sessionId: string }> };

const VALID_STATUSES = ["active", "completed", "archived"] as const;

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { sessionId } = await ctx.params;
  const { data, error } = await getMySession(result.user, sessionId);

  if (error || !data) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  return jsonNoStore({ session: data });
});

export const PATCH = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: {
    patient_label?: string | null;
    status?: (typeof VALID_STATUSES)[number];
  } = {};

  if ("patient_label" in body) {
    if (body.patient_label !== null && typeof body.patient_label !== "string") {
      return jsonNoStore(
        { error: "patient_label must be a string or null" },
        { status: 400 },
      );
    }

    update.patient_label = body.patient_label;
  }

  if ("status" in body) {
    if (
      typeof body.status !== "string" ||
      !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])
    ) {
      return jsonNoStore(
        { error: "status must be one of: active, completed, archived" },
        { status: 400 },
      );
    }

    update.status = body.status as (typeof VALID_STATUSES)[number];
  }

  if (Object.keys(update).length === 0) {
    return jsonNoStore({ error: "No valid fields to update" }, { status: 400 });
  }

  const { sessionId } = await ctx.params;
  const { data, error } = await updateMySession(result.user, sessionId, update);

  if (error || !data) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  void writeAuditLog({
    orgId: result.user.orgId,
    actorId: result.user.userId,
    sessionId,
    action: "session.updated",
    requestId: request.headers.get("x-vercel-id") ?? undefined,
    metadata: {
      updated_fields: Object.keys(update),
    },
  });

  return jsonNoStore({ session: data });
});

export const DELETE = withLogging(async (
  request: NextRequest,
  ctx: RouteContext,
) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { sessionId } = await ctx.params;
  const { data: session, error } = await getMySession(result.user, sessionId);

  if (error || !session) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  try {
    await softDeleteSession(result.user, sessionId);
  } catch (cascadeError) {
    logError({
      code: ErrorCodes.SESSION_DELETE_FAILED,
      message: "Session deletion failed",
      cause: cascadeError,
      sessionId,
      orgId: result.user.orgId,
      userId: result.user.userId,
    });
    return jsonNoStore(
      {
        error: {
          code: ErrorCodes.SESSION_DELETE_FAILED,
          message: "Unable to delete session.",
        },
      },
      { status: 500 },
    );
  }

  void writeAuditLog({
    orgId: result.user.orgId,
    actorId: result.user.userId,
    sessionId,
    action: "session.deleted",
    requestId: request.headers.get("x-vercel-id") ?? undefined,
    metadata: {
      deleted_by_role: result.user.role,
      deleted_session_owner: session.created_by,
    },
  });

  return jsonNoStore({ deleted: true });
});
