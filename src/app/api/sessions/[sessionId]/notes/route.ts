import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getLatestNoteForSession } from "@/lib/clinical/queries";
import { getMySession } from "@/lib/sessions/queries";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await ctx.params;
  const session = await getMySession(result.user, sessionId);

  if (session.error || !session.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const note = await getLatestNoteForSession(result.user, sessionId);

  if (note.error) {
    return NextResponse.json(
      { error: "Failed to load note" },
      { status: 500 },
    );
  }

  return NextResponse.json({ note: note.data });
}
