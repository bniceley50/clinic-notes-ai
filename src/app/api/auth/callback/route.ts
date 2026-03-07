import { NextResponse, type NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey, isDevLoginAllowed } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/server";
import { createSessionCookie } from "@/lib/auth/session";
import type { SessionRole } from "@/lib/auth/types";

const DEFAULT_REDIRECT = "/dashboard";

function getSupabaseClient() {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function renderImplicitBridge(next: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Signing in…</title>
  </head>
  <body>
    <script>
      (async function () {
        const redirectTo = ${JSON.stringify(next)};
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const error = hash.get("error") || hash.get("error_description");

        if (error) {
          window.location.replace("/login?error=invalid_token");
          return;
        }

        if (!accessToken) {
          window.location.replace("/login?error=missing_token");
          return;
        }

        const response = await fetch(window.location.pathname + window.location.search, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            access_token: accessToken,
            next: redirectTo
          })
        });

        if (!response.ok) {
          window.location.replace("/login?error=invalid_token");
          return;
        }

        const payload = await response.json();
        window.location.replace(payload.redirectTo || redirectTo);
      })();
    </script>
    <p>Signing you in…</p>
  </body>
</html>`;
}

async function resolveUserProfile(user: User, request: NextRequest) {
  const admin = createServiceClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (profile) {
    return {
      practiceId: profile.org_id,
      role: profile.role as SessionRole,
      error: null,
    };
  }

  if (!isDevLoginAllowed()) {
    return {
      practiceId: null,
      role: null,
      error: NextResponse.redirect(
        new URL("/login?error=no_profile", request.url),
      ),
    };
  }

  const { data: newOrg, error: orgError } = await admin
    .from("orgs")
    .insert({ name: `${user.email ?? "user"}'s practice` })
    .select("id")
    .single();

  if (orgError || !newOrg) {
    return {
      practiceId: null,
      role: null,
      error: NextResponse.redirect(
        new URL("/login?error=bootstrap_failed", request.url),
      ),
    };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    user_id: user.id,
    org_id: newOrg.id,
    display_name: user.email ?? "Dev User",
    role: "provider" as SessionRole,
  });

  if (profileError) {
    return {
      practiceId: null,
      role: null,
      error: NextResponse.redirect(
        new URL("/login?error=bootstrap_failed", request.url),
      ),
    };
  }

  return {
    practiceId: newOrg.id,
    role: "provider" as SessionRole,
    error: null,
  };
}

async function createAppRedirectResponse(input: {
  request: NextRequest;
  user: User;
  next: string;
}) {
  const resolved = await resolveUserProfile(input.user, input.request);
  if (resolved.error) {
    return resolved.error;
  }

  const cookie = await createSessionCookie({
    sub: input.user.id,
    email: input.user.email,
    practiceId: resolved.practiceId!,
    role: resolved.role!,
  });

  const response = NextResponse.redirect(
    new URL(input.next || DEFAULT_REDIRECT, input.request.url),
    303,
  );
  response.headers.append("Set-Cookie", cookie);
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? DEFAULT_REDIRECT;

  const supabase = getSupabaseClient();

  if (code) {
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !sessionData.user) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_code", request.url),
      );
    }

    return createAppRedirectResponse({
      request,
      user: sessionData.user,
      next,
    });
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email" | "recovery" | "invite" | "email_change",
    });

    if (error || !data.user) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_token", request.url),
      );
    }

    return createAppRedirectResponse({
      request,
      user: data.user,
      next,
    });
  }

  return new NextResponse(renderImplicitBridge(next), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.access_token !== "string") {
    return NextResponse.json(
      { error: "Missing access_token in request body" },
      { status: 400 },
    );
  }

  const next =
    typeof body.next === "string" && body.next.startsWith("/")
      ? body.next
      : DEFAULT_REDIRECT;

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(
    body.access_token,
  );

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Invalid or expired Supabase token" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true, redirectTo: next });
  const resolved = await resolveUserProfile(userData.user, request);

  if (resolved.error) {
    return NextResponse.json({ error: "No profile" }, { status: 403 });
  }

  const cookie = await createSessionCookie({
    sub: userData.user.id,
    email: userData.user.email,
    practiceId: resolved.practiceId!,
    role: resolved.role!,
  });

  response.headers.append("Set-Cookie", cookie);
  return response;
}
