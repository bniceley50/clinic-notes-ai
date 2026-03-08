import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";
import { toSessionUser } from "@/lib/auth/claims";

const PUBLIC_PATHS = ["/login", "/dev-login", "/api/auth", "/api/health"];

const STATIC_ASSET_PATTERN =
  /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot|map)$/;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Worker endpoint uses bearer token auth in-route, not cookie session auth.
  if (
    /^\/api\/jobs\/[^/]+\/worker$/.test(pathname) ||
    pathname === "/api/jobs/runner"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  if (STATIC_ASSET_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await readSessionFromCookieHeader(
    request.headers.get("cookie"),
  );

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = toSessionUser(session);

  const headers = new Headers(request.headers);
  headers.set("x-user-id", user.userId);
  headers.set("x-org-id", user.orgId);
  headers.set("x-user-role", user.role);

  return NextResponse.next({
    request: { headers },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
