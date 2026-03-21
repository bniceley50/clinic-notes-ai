import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import {
  deleteSessionCascade,
  getMySession,
  updateMySession,
} from "@/lib/sessions/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ sessionId: string }> };

const VALID_SESSION_TYPES = ["general", "intake", "follow-up"] as const;
const VALID_STATUSES = ["active", "completed", "archived"] as const;

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { sessionId } = await ctx.params;
  const { data, error } = await getMySession(result.user, sessionId);

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ session: data });
});

export const PATCH = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: {
    patient_label?: string | null;
    session_type?: (typeof VALID_SESSION_TYPES)[number];
    status?: (typeof VALID_STATUSES)[number];
  } = {};

  if ("patient_label" in body) {
    if (body.patient_label !== null && typeof body.patient_label !== "string") {
      return NextResponse.json(
        { error: "patient_label must be a string or null" },
        { status: 400 },
      );
    }

    update.patient_label = body.patient_label;
  }

  if ("session_type" in body) {
    if (
      typeof body.session_type !== "string" ||
      !VALID_SESSION_TYPES.includes(body.session_type as (typeof VALID_SESSION_TYPES)[number])
    ) {
      return NextResponse.json(
        { error: "session_type must be one of: general, intake, follow-up" },
        { status: 400 },
      );
    }

    update.session_type = body.session_type as (typeof VALID_SESSION_TYPES)[number];
  }

  if ("status" in body) {
    if (
      typeof body.status !== "string" ||
      !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])
    ) {
      return NextResponse.json(
        { error: "status must be one of: active, completed, archived" },
        { status: 400 },
      );
    }

    update.status = body.status as (typeof VALID_STATUSES)[number];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { sessionId } = await ctx.params;
  const { data, error } = await updateMySession(result.user, sessionId, update);

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ session: data });
});

export const DELETE = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { sessionId } = await ctx.params;
  const { data: session, error } = await getMySession(result.user, sessionId);

  if (error || !session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteSessionCascade(sessionId, result.user.orgId);
  } catch (cascadeError) {
    const message =
      cascadeError instanceof Error ? cascadeError.message : "Failed to delete session";
    return NextResponse.json({ error: message }, { status: 500 });
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

  return NextResponse.json({ deleted: true });
});
