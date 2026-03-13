import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getLatestNoteForSession } from "@/lib/clinical/queries";
import { getMySession } from "@/lib/sessions/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

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
});