import type { NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { writeAuditLog } from "@/lib/audit";
import { getMyNote, updateMyNoteContent } from "@/lib/clinical/queries";
import { ErrorCodes } from "@/lib/errors/codes";
import { jsonNoStore } from "@/lib/http/response";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { logError, withLogging } from "@/lib/logger";
import {
  UpdateNoteRouteSchema,
  validateBody,
} from "@/lib/validation/note-validation";

type RouteContext = {
  params: Promise<{ sessionId: string; noteId: string }>;
};

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { sessionId, noteId } = await ctx.params;
  const current = await getMyNote(result.user, sessionId, noteId);

  if (current.error || !current.data) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  return jsonNoStore({ note: current.data });
});

export const PATCH = withLogging(async (
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

  const { sessionId, noteId } = await ctx.params;
  const rawBody = await request.json().catch(() => null);
  const validation = validateBody(
    UpdateNoteRouteSchema.safeParse(rawBody),
    { sessionId, userId: result.user.userId },
  );
  if (validation.error) return validation.error;
  const body = validation.data;

  const current = await getMyNote(result.user, sessionId, noteId);

  if (current.error || !current.data) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await updateMyNoteContent(
    result.user,
    sessionId,
    noteId,
    body.content,
  );

  if (error || !data) {
    logError({
      code: ErrorCodes.NOTE_UPDATE_FAILED,
      message: "Note update failed",
      cause: error,
      sessionId,
      userId: result.user.userId,
      orgId: result.user.orgId,
      noteId,
    });

    return jsonNoStore(
      {
        error: {
          code: ErrorCodes.NOTE_UPDATE_FAILED,
          message: "Unable to update note.",
        },
      },
      { status: 500 },
    );
  }

  void writeAuditLog({
    orgId: result.user.orgId,
    actorId: result.user.userId,
    sessionId,
    action: "note.edited",
    metadata: {
      note_id: noteId,
    },
  });

  return jsonNoStore({ note: data });
});
