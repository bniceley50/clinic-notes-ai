/**
 * GET /api/me
 *
 * Returns the current user's identity from middleware-injected headers.
 * Useful for verifying the auth pipeline works end-to-end.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

export const GET = withLogging(async (request: NextRequest) => {
  const result = await loadCurrentUser();
  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  return NextResponse.json({
    userId: request.headers.get("x-user-id"),
    orgId: request.headers.get("x-org-id"),
    role: request.headers.get("x-user-role"),
  });
});