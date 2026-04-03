import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSessionCookie } from "@/lib/auth/session";
import { resolveUserProfileGlobally } from "@/lib/auth/provisioning";
import { writeAuditLog } from "@/lib/audit";
import { authLimit, checkRateLimit, getIdentifier } from "@/lib/rate-limit";
import { supabaseAnonKey, supabaseUrl } from "@/lib/config";
import { withLogging } from "@/lib/logger";

function getSupabaseClient() {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const POST = withLogging(async (request: NextRequest) => {
  const identifier = getIdentifier(request);
  const limited = await checkRateLimit(authLimit, identifier);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.access_token !== "string" || body.access_token.trim() === "") {
    return NextResponse.json(
      { error: "Missing access_token in request body" },
      { status: 400 },
    );
  }

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

  const resolved = await resolveUserProfileGlobally(userData.user);

  if (resolved.errorCode === "no_invite") {
    return NextResponse.json({ error: "no_invite" }, { status: 403 });
  }

  if (resolved.errorCode === "bootstrap_failed") {
    return NextResponse.json({ error: "bootstrap_failed" }, { status: 500 });
  }

  if (resolved.errorCode) {
    return NextResponse.json({ error: "No profile" }, { status: 500 });
  }

  const cookie = await createSessionCookie({
    sub: userData.user.id,
    email: userData.user.email,
    practiceId: resolved.orgId!,
    role: resolved.role!,
  });

  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", cookie);

  void writeAuditLog({
    orgId: resolved.orgId!,
    actorId: userData.user.id,
    action: "auth.login",
  });

  return response;
});
