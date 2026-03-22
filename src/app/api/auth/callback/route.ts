import { NextResponse, type NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey, isDevLoginAllowed } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/server";
import { createSessionCookie } from "@/lib/auth/session";
import type { SessionRole } from "@/lib/auth/types";
import { withLogging } from "@/lib/logger";

const DEFAULT_REDIRECT = "/sessions";

type ProvisioningErrorCode = "no_invite" | "bootstrap_failed";

function sanitizeNext(rawNext: string | null | undefined): string {
  if (
    typeof rawNext === "string" &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
  ) {
    return rawNext;
  }

  return DEFAULT_REDIRECT;
}

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

async function resolveUserProfile(user: User) {
  const admin = createServiceClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (profile) {
    return {
      orgId: profile.org_id,
      role: profile.role as SessionRole,
      errorCode: null as ProvisioningErrorCode | null,
    };
  }

  if (!isDevLoginAllowed()) {
    const { data: invite } = await admin
      .from("invites")
      .select("id, org_id, role")
      .eq("email", (user.email ?? "").toLowerCase())
      .is("used_at", null)
      .single();

    if (!invite) {
      return {
        orgId: null,
        role: null,
        errorCode: "no_invite" as const,
      };
    }

    const { error: profileError } = await admin
      .from("profiles")
      .insert({
        user_id: user.id,
        org_id: invite.org_id,
        display_name: user.email ?? "Clinician",
        role: invite.role as SessionRole,
      });

    if (profileError) {
      return {
        orgId: null,
        role: null,
        errorCode: "bootstrap_failed" as const,
      };
    }

    await admin
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return {
      orgId: invite.org_id,
      role: invite.role as SessionRole,
      errorCode: null as ProvisioningErrorCode | null,
    };
  }

  const { data: newOrg, error: orgError } = await admin
    .from("orgs")
    .insert({ name: `${user.email ?? "user"}'s practice` })
    .select("id")
    .single();

  if (orgError || !newOrg) {
    return {
      orgId: null,
      role: null,
      errorCode: "bootstrap_failed" as const,
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
      orgId: null,
      role: null,
      errorCode: "bootstrap_failed" as const,
    };
  }

  return {
    orgId: newOrg.id,
    role: "provider" as SessionRole,
    errorCode: null as ProvisioningErrorCode | null,
  };
}

function redirectForProvisioningError(
  code: ProvisioningErrorCode,
  request: NextRequest,
) {
  return NextResponse.redirect(
    new URL(`/login?error=${code}`, request.url),
  );
}

async function createAppRedirectResponse(input: {
  request: NextRequest;
  user: User;
  next: string;
}) {
  const resolved = await resolveUserProfile(input.user);
  if (resolved.errorCode) {
    return redirectForProvisioningError(resolved.errorCode, input.request);
  }

  const cookie = await createSessionCookie({
    sub: input.user.id,
    email: input.user.email,
    practiceId: resolved.orgId!,
    role: resolved.role!,
  });

  const response = NextResponse.redirect(
    new URL(input.next || DEFAULT_REDIRECT, input.request.url),
    303,
  );
  response.headers.append("Set-Cookie", cookie);
  return response;
}

export const GET = withLogging(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitizeNext(searchParams.get("next"));

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
});

export const POST = withLogging(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.access_token !== "string") {
    return NextResponse.json(
      { error: "Missing access_token in request body" },
      { status: 400 },
    );
  }

  const next = sanitizeNext(
    typeof body.next === "string" ? body.next : null,
  );

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
  const resolved = await resolveUserProfile(userData.user);

  if (resolved.errorCode === "no_invite") {
    return NextResponse.json({ error: "no_invite" }, { status: 403 });
  }

  if (resolved.errorCode === "bootstrap_failed") {
    return NextResponse.json({ error: "bootstrap_failed" }, { status: 403 });
  }

  if (resolved.errorCode) {
    return NextResponse.json({ error: "No profile" }, { status: 403 });
  }

  const cookie = await createSessionCookie({
    sub: userData.user.id,
    email: userData.user.email,
    practiceId: resolved.orgId!,
    role: resolved.role!,
  });

  response.headers.append("Set-Cookie", cookie);
  return response;
});
