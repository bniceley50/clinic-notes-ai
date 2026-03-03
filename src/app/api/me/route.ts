/**
 * GET /api/me
 *
 * Returns the current user's identity from middleware-injected headers.
 * Useful for verifying the auth pipeline works end-to-end.
 */

import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    userId: request.headers.get("x-user-id"),
    orgId: request.headers.get("x-org-id"),
    role: request.headers.get("x-user-role"),
  });
}
