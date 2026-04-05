import type { NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { ErrorCodes } from "@/lib/errors/codes";
import { jsonNoStore } from "@/lib/http/response";
import { getMySession } from "@/lib/sessions/queries";
import {
  createJob,
  getActiveJobForSession,
  getJobsForSession,
  type JobNoteType,
} from "@/lib/jobs/queries";
import { serializeJobForClient } from "@/lib/jobs/serialize-job-for-client";
import { createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { logError, withLogging } from "@/lib/logger";
import {
  CreateJobSchema,
  validateBody,
} from "@/lib/validation/note-validation";

export const GET = withLogging(async (request: NextRequest) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return jsonNoStore(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  const session = await getMySession(result.user, sessionId);
  if (session.error || !session.data) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await getJobsForSession(result.user, sessionId);
  if (error) {
    return jsonNoStore(
      { error: "Failed to load jobs" },
      { status: 500 },
    );
  }

  return jsonNoStore({ jobs: data.map(serializeJobForClient) });
});

export const POST = withLogging(async (request: NextRequest) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const rawBody = await request.json().catch(() => null);
  const validation = validateBody(
    CreateJobSchema.safeParse(rawBody),
    { userId: result.user.userId },
  );
  if (validation.error) return validation.error;
  const body = validation.data;
  const sessionId = body.session_id;
  const noteType = body.note_type as JobNoteType;

  const session = await getMySession(result.user, sessionId);
  if (session.error || !session.data) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const db = createServiceClient();
  const { data: consent, error: consentError } = await db
    .from("session_consents")
    .select("id")
    .eq("session_id", sessionId)
    .eq("org_id", result.user.orgId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (consentError) {
    return jsonNoStore(
      { error: "Failed to verify patient consent" },
      { status: 500 },
    );
  }

  if (!consent) {
    return jsonNoStore(
      { error: "Patient consent must be recorded before starting a job" },
      { status: 403 },
    );
  }

  const active = await getActiveJobForSession(result.user, sessionId);
  if (active.error) {
    return jsonNoStore(
      {
        error: {
          code: ErrorCodes.JOB_CREATE_FAILED,
          message: "Unable to create job.",
        },
      },
      { status: 500 },
    );
  }

  if (active.data) {
    return jsonNoStore(
      {
        error: {
          code: ErrorCodes.JOB_CREATE_FAILED,
          message:
            "This session already has an active job. Wait for it to finish or cancel it first.",
        },
        job: serializeJobForClient(active.data),
      },
      { status: 409 },
    );
  }

  const { data, error } = await createJob(result.user, {
    session_id: sessionId,
    note_type: noteType as JobNoteType,
  });

  if (error || !data) {
    const isConflict = error?.includes("active job");
    if (!isConflict) {
      logError({
        code: ErrorCodes.JOB_CREATE_FAILED,
        message: "Job creation failed",
        cause: error,
        orgId: result.user.orgId,
        userId: result.user.userId,
        sessionId,
      });
    }

    return jsonNoStore(
      {
        error: {
          code: ErrorCodes.JOB_CREATE_FAILED,
          message: isConflict
            ? "This session already has an active job. Wait for it to finish or cancel it first."
            : "Unable to create job.",
        },
      },
      { status: isConflict ? 409 : 500 },
    );
  }

  void writeAuditLog({
    orgId: result.user.orgId,
    actorId: result.user.userId,
    sessionId,
    jobId: data.id,
    action: "job.created",
    requestId: request.headers.get("x-vercel-id") ?? undefined,
    metadata: { note_type: noteType },
  });

  return jsonNoStore({ job: serializeJobForClient(data) }, { status: 201 });
});
