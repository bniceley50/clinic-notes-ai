/**
 * POST /api/auth/logout
 *
 * Clears the session cookie and redirects to /login.
 * Uses 303 See Other so the browser issues a GET to /login
 * instead of re-POSTing.
 */

import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}
