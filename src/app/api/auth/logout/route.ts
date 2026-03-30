/**
 * POST /api/auth/logout
 *
 * Revokes the session JTI in Redis, clears the session cookie,
 * and redirects to /login. Uses 303 See Other so the browser
 * issues a GET to /login instead of re-POSTing.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  clearSessionCookie,
  readSessionFromCookieHeader,
} from "@/lib/auth/session";
import { resolveOrgId } from "@/lib/auth/claims";
import { revokeSession } from "@/lib/auth/revocation";
import { writeAuditLog } from "@/lib/audit";
import { sessionTtlSeconds } from "@/lib/config";
import { withLogging } from "@/lib/logger";
import { apiLimit, checkRateLimit, getIdentifier } from "@/lib/rate-limit";

export const POST = withLogging(async (request: NextRequest) => {
  // Read session before clearing cookie so we can revoke the JTI
  const session = await readSessionFromCookieHeader(
    request.headers.get("cookie"),
  );
  const identifier = getIdentifier(request, session?.sub ?? null);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  if (session?.jti) {
    try {
      await revokeSession(session.jti, sessionTtlSeconds());
    } catch {
      // Revocation write failed — do not clear the cookie.
      // Returning 503 so the client knows logout did not complete.
      // The user can retry; the session remains valid until Redis recovers.
      return NextResponse.json(
        { error: "Logout unavailable. Please try again." },
        { status: 503 },
      );
    }
  }

  if (session) {
    void writeAuditLog({
      orgId: resolveOrgId(session),
      actorId: session.sub,
      action: "auth.logout",
    });
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
});
