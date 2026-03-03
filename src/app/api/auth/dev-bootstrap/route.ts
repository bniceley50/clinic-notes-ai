/**
 * POST /api/auth/dev-bootstrap
 *
 * Dev-only route that bootstraps a usable session for a Supabase Auth user.
 *
 * Flow:
 *   1. Client signs in via Supabase magic link → gets Supabase access token
 *   2. Client POSTs that token here
 *   3. This route verifies the token with Supabase, creates org + profile
 *      if needed (via service role), then mints the app session cookie.
 *
 * This route is gated by ALLOW_DEV_LOGIN=1 + NODE_ENV=development.
 * It must never be accessible in production.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDevLoginAllowed, supabaseUrl, supabaseAnonKey } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/server";
import { createSessionCookie } from "@/lib/auth/session";
import type { SessionRole } from "@/lib/auth/types";

export async function POST(request: NextRequest) {
  if (!isDevLoginAllowed()) {
    return NextResponse.json(
      { error: "Dev bootstrap is disabled" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.access_token !== "string") {
    return NextResponse.json(
      { error: "Missing access_token in request body" },
      { status: 400 },
    );
  }

  const supabaseAuth = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } =
    await supabaseAuth.auth.getUser(body.access_token);

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Invalid or expired Supabase token" },
      { status: 401 },
    );
  }

  const user = userData.user;
  const admin = createServiceClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  let orgId: string;
  let role: SessionRole;

  if (existingProfile) {
    orgId = existingProfile.org_id;
    role = existingProfile.role as SessionRole;
  } else {
    const { data: newOrg, error: orgError } = await admin
      .from("orgs")
      .insert({ name: `${user.email ?? "dev"}'s practice` })
      .select("id")
      .single();

    if (orgError || !newOrg) {
      return NextResponse.json(
        { error: "Failed to create org", detail: orgError?.message },
        { status: 500 },
      );
    }

    orgId = newOrg.id;
    role = "provider";

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: user.id,
      org_id: orgId,
      display_name: user.email ?? "Dev User",
      role,
    });

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to create profile", detail: profileError.message },
        { status: 500 },
      );
    }
  }

  const cookie = await createSessionCookie({
    sub: user.id,
    email: user.email,
    practiceId: orgId,
    role,
  });

  const response = NextResponse.json({
    ok: true,
    userId: user.id,
    orgId,
    role,
  });

  response.headers.append("Set-Cookie", cookie);

  return response;
}
