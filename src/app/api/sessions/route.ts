import type { NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { ErrorCodes } from "@/lib/errors/codes";
import { jsonNoStore } from "@/lib/http/response";
import { createSession, listMySessions } from "@/lib/sessions/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { logError, withLogging } from "@/lib/logger";
import {
  CreateSessionSchema,
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

  const { data, error } = await listMySessions(result.user);

  if (error) {
    return jsonNoStore(
      { error: "Failed to load sessions" },
      { status: 500 },
    );
  }

  return jsonNoStore({ sessions: data });
});

export const POST = withLogging(async (
  request: NextRequest,
) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const rawBody = await request.json().catch(() => null);
  const validation = validateBody(
    CreateSessionSchema.safeParse(rawBody),
    { userId: result.user.userId },
  );
  if (validation.error) return validation.error;
  const body = validation.data;

  const { data, error } = await createSession(result.user, {
    patient_label: body.patient_label,
    session_type: body.session_type,
  });

  if (error || !data) {
    logError({
      code: ErrorCodes.SESSION_CREATE_FAILED,
      message: "Session creation failed",
      cause: error,
      orgId: result.user.orgId,
      userId: result.user.userId,
    });

    return jsonNoStore(
      {
        error: {
          code: ErrorCodes.SESSION_CREATE_FAILED,
          message: "Unable to create session.",
        },
      },
      { status: 500 },
    );
  }

  return jsonNoStore({ session: data }, { status: 201 });
});
