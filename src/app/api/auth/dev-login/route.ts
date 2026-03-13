/**
 * GET /api/auth/dev-login
 *
 * Local development shortcut that mints a deterministic app session cookie
 * and redirects to the sessions page.
 *
 * This route is gated by ALLOW_DEV_LOGIN=1 + NODE_ENV=development and must
 * never be reachable in production.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isDevLoginAllowed } from "@/lib/config";
import { createSessionCookie } from "@/lib/auth/session";
import type { SessionRole } from "@/lib/auth/types";
import { withLogging } from "@/lib/logger";

const DEV_LOGIN_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_LOGIN_EMAIL = "dev@example.com";
const DEV_LOGIN_ORG_ID = "00000000-0000-0000-0000-000000000002";
const DEV_LOGIN_ROLE: SessionRole = "provider";

export const GET = withLogging(async (request: NextRequest) => {
  if (!isDevLoginAllowed()) {
    return NextResponse.json({ error: "Dev login is disabled" }, { status: 403 });
  }

  const cookie = await createSessionCookie({
    sub: DEV_LOGIN_USER_ID,
    email: DEV_LOGIN_EMAIL,
    practiceId: DEV_LOGIN_ORG_ID,
    role: DEV_LOGIN_ROLE,
  });

  const response = NextResponse.redirect(new URL("/sessions", request.url), 303);
  response.headers.append("Set-Cookie", cookie);
  return response;
});