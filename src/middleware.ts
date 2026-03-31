import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearSessionCookie, readSessionFromCookieHeader } from "@/lib/auth/session";
import { toSessionUser } from "@/lib/auth/claims";
import { isSessionRevoked } from "@/lib/auth/revocation";
import { buildContentSecurityPolicy } from "@/lib/security/headers";

const PUBLIC_PATHS = ["/login", "/set-password", "/dev-login", "/api/auth", "/api/health"];

const STATIC_ASSET_PATTERN =
  /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot|map)$/;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * Generate a cryptographically random nonce for CSP.
 * Uses the Web Crypto API available in the Next.js Edge runtime.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Attach the nonce-locked CSP header to a response.
 * Called on every response branch that may return HTML.
 */
function attachCsp(
  response: NextResponse,
  nonce: string,
  isProduction: boolean,
): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy({ nonce, isProduction }),
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === "production";

  // Skip nonce/CSP for Next.js internals and static assets —
  // these are not HTML responses and do not need a CSP header.
  if (
    pathname.startsWith("/_next/") ||
    STATIC_ASSET_PATTERN.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Generate a fresh nonce for this request.
  // Must happen before any branch that returns an HTML response.
  const nonce = generateNonce();

  // Worker, process, and runner endpoints use in-route auth, not cookie session auth.
  if (
    /^\/api\/jobs\/[^/]+\/worker$/.test(pathname) ||
    /^\/api\/jobs\/[^/]+\/process$/.test(pathname) ||
    pathname === "/api/jobs/runner"
  ) {
    const res = NextResponse.next();
    return attachCsp(res, nonce, isProduction);
  }

  if (isPublicPath(pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    return attachCsp(res, nonce, isProduction);
  }

  const session = await readSessionFromCookieHeader(
    request.headers.get("cookie"),
  );

  if (!session) {
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return attachCsp(res, nonce, isProduction);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    return attachCsp(res, nonce, isProduction);
  }

  // JTI revocation check — reject tokens that were explicitly revoked at logout.
  const revoked = await isSessionRevoked(session.jti);
  if (revoked) {
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      res.headers.append("Set-Cookie", clearSessionCookie());
      return attachCsp(res, nonce, isProduction);
    }
    const loginUrl = new URL("/login", request.url);
    const res = NextResponse.redirect(loginUrl);
    res.headers.append("Set-Cookie", clearSessionCookie());
    return attachCsp(res, nonce, isProduction);
  }

  const user = toSessionUser(session);

  const headers = new Headers(request.headers);
  headers.set("x-user-id", user.userId);
  headers.set("x-org-id", user.orgId);
  headers.set("x-user-role", user.role);
  headers.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers } });
  return attachCsp(res, nonce, isProduction);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
