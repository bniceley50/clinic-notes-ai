import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { consentLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, ctx: RouteContext) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(consentLimit, identifier);
  if (limited) return limited;

  const { sessionId } = await ctx.params;
  const session = await getMySession(result.user, sessionId);

  if (session.error || !session.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.hipaa_consent !== true) {
    return NextResponse.json(
      { error: "HIPAA consent required" },
      { status: 400 },
    );
  }

  const part2Applicable =
    typeof body.part2_applicable === "boolean"
      ? body.part2_applicable
      : false;

  const part2Consent =
    body.part2_consent === null || typeof body.part2_consent === "boolean"
      ? body.part2_consent
      : null;

  if (part2Applicable && part2Consent !== true) {
    return NextResponse.json(
      { error: "42 CFR Part 2 consent required" },
      { status: 400 },
    );
  }

  const db = createServiceClient();
  const now = new Date().toISOString();

  const { error } = await db.from("session_consents").insert({
    session_id: sessionId,
    org_id: result.user.orgId,
    clinician_id: result.user.userId,
    hipaa_consent: true,
    hipaa_consented_at: now,
    part2_applicable: part2Applicable,
    part2_consent: part2Applicable ? true : null,
    part2_consented_at: part2Applicable ? now : null,
    ip_address: request.headers.get("x-forwarded-for"),
    user_agent: request.headers.get("user-agent"),
    updated_at: now,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to record consent" },
      { status: 500 },
    );
  }

  await writeAuditLog({
    orgId: result.user.orgId,
    actorId: result.user.userId,
    sessionId,
    action: part2Applicable
      ? "consent.part2_recorded"
      : "consent.recorded",
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    requestId: request.headers.get("x-vercel-id") ?? undefined,
    metadata: {
      part2_applicable: part2Applicable,
      part2_consent: part2Applicable ? true : null,
    },
  });

  return NextResponse.json({ ok: true });
}