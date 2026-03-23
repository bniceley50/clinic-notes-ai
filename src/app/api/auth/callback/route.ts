import { NextResponse, type NextRequest } from "next/server";
import { withLogging } from "@/lib/logger";

export const GET = withLogging(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const target = new URL("/set-password", request.url);
  for (const [key, value] of searchParams.entries()) {
    target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target, 303);
});
