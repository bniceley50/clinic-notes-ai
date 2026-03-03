/**
 * GET /api/auth/callback
 *
 * Handles the Supabase magic link redirect. Exchanges the auth code
 * for a Supabase session, looks up the user's profile, mints the
 * app session cookie, and redirects to the app.
 *
 * If the user has no profile yet and dev bootstrap is enabled,
 * redirects to a bootstrap flow. In production, a missing profile
 * means the admin hasn't provisioned the user — show an error.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey, isDevLoginAllowed } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/server";
import { createSessionCookie } from "@/lib/auth/session";
import type { SessionRole } from "@/lib/auth/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const supabase = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !sessionData.user) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_code", request.url),
    );
  }

  const user = sessionData.user;
  const admin = createServiceClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    if (isDevLoginAllowed()) {
      const { data: newOrg, error: orgError } = await admin
        .from("orgs")
        .insert({ name: `${user.email ?? "user"}'s practice` })
        .select("id")
        .single();

      if (orgError || !newOrg) {
        return NextResponse.redirect(
          new URL("/login?error=bootstrap_failed", request.url),
        );
      }

      const { error: profileError } = await admin.from("profiles").insert({
        user_id: user.id,
        org_id: newOrg.id,
        display_name: user.email ?? "Dev User",
        role: "provider" as SessionRole,
      });

      if (profileError) {
        return NextResponse.redirect(
          new URL("/login?error=bootstrap_failed", request.url),
        );
      }

      const cookie = await createSessionCookie({
        sub: user.id,
        email: user.email,
        practiceId: newOrg.id,
        role: "provider",
      });

      const response = NextResponse.redirect(new URL(next, request.url));
      response.headers.append("Set-Cookie", cookie);
      return response;
    }

    return NextResponse.redirect(
      new URL("/login?error=no_profile", request.url),
    );
  }

  const cookie = await createSessionCookie({
    sub: user.id,
    email: user.email,
    practiceId: profile.org_id,
    role: profile.role as SessionRole,
  });

  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.append("Set-Cookie", cookie);
  return response;
}
