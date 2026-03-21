import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMyNote } from "@/lib/clinical/queries";
import { jsonNoStore, withNoStoreHeaders } from "@/lib/http/response";
import { buildDocxFilename } from "@/lib/clinical/note-format";
import { buildNoteDocxBuffer } from "@/lib/clinical/note-export";
import { getMySession } from "@/lib/sessions/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

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
  const [sessionResult, noteResult] = await Promise.all([
    getMySession(result.user, sessionId),
    getMyNote(result.user, sessionId, noteId),
  ]);

  if (sessionResult.error || !sessionResult.data) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  if (noteResult.error || !noteResult.data) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const session = sessionResult.data;
  const note = noteResult.data;
  const sessionDate = new Date(session.created_at);

  const buffer = await buildNoteDocxBuffer({
    noteType: note.note_type,
    dateLabel: sessionDate.toLocaleDateString(),
    patientLabel: session.patient_label ?? "Patient A",
    providerName: result.user.profile.display_name,
    content: note.content,
  });

  return new NextResponse(new Uint8Array(buffer), {
    ...withNoStoreHeaders({
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=\"${buildDocxFilename(
          session.session_type,
          sessionDate,
        )}\"`,
      },
    }),
  });
});
