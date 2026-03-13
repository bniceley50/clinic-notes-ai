import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { createSession, listMySessions } from "@/lib/sessions/queries";
import { apiLimit, getIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { withLogging } from "@/lib/logger";

const VALID_SESSION_TYPES = ["general", "intake", "follow-up"] as const;

export const GET = withLogging(async (request: NextRequest) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { data, error } = await listMySessions(result.user);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load sessions" },
      { status: 500 },
    );
  }

  return NextResponse.json({ sessions: data });
});

export const POST = withLogging(async (request: NextRequest) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const patientLabel =
    body && typeof body.patient_label === "string" ? body.patient_label.trim() : "";
  const sessionType =
    body && typeof body.session_type === "string" ? body.session_type : "general";

  if (!patientLabel) {
    return NextResponse.json(
      { error: "patient_label is required" },
      { status: 400 },
    );
  }

  if (!VALID_SESSION_TYPES.includes(sessionType as (typeof VALID_SESSION_TYPES)[number])) {
    return NextResponse.json(
      { error: "session_type must be one of: general, intake, follow-up" },
      { status: 400 },
    );
  }

  const { data, error } = await createSession(result.user, {
    patient_label: patientLabel,
    session_type: sessionType as (typeof VALID_SESSION_TYPES)[number],
  });

  if (error || !data) {
    return NextResponse.json({ error: error ?? "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ session: data }, { status: 201 });
});