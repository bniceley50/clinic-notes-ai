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
import { revokeSession } from "@/lib/auth/revocation";
import { writeAuditLog } from "@/lib/audit";
import { sessionTtlSeconds } from "@/lib/config";

export async function POST(request: NextRequest) {
  // Read session before clearing cookie so we can revoke the JTI
  const session = await readSessionFromCookieHeader(
    request.headers.get("cookie")
  );

  if (session?.jti) {
    await revokeSession(session.jti, sessionTtlSeconds());
  }

  if (session) {
    void writeAuditLog({
      orgId: session.practiceId,
      actorId: session.sub,
      action: "auth.logout",
    });
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}