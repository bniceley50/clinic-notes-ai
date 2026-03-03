import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth middleware — protects all routes except public paths.
 *
 * TODO: Implement real session verification once auth flow is built.
 * Currently passes all requests through (bootstrap-safe).
 *
 * Protected routes: everything under (dashboard)
 * Public routes: /login, /api/auth/*, /api/health
 */

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // TODO: Read session from cookie, redirect to /login if missing.
  // For now, pass through so the app boots during bootstrap.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
