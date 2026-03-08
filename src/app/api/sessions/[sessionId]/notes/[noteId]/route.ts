import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMyNote, updateMyNoteContent } from "@/lib/clinical/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string; noteId: string }>;
};

export async function GET(request: NextRequest, ctx: RouteContext) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { sessionId, noteId } = await ctx.params;
  const current = await getMyNote(result.user, sessionId, noteId);

  if (current.error || !current.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ note: current.data });
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
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

  if ("note_type" in body) {
    return NextResponse.json(
      { error: "note_type cannot be edited" },
      { status: 400 },
    );
  }

  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "content must be a string" },
      { status: 400 },
    );
  }

  const { sessionId, noteId } = await ctx.params;
  const current = await getMyNote(result.user, sessionId, noteId);

  if (current.error || !current.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await updateMyNoteContent(
    result.user,
    sessionId,
    noteId,
    body.content,
  );

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Failed to update note" },
      { status: 500 },
    );
  }

  return NextResponse.json({ note: data });
}