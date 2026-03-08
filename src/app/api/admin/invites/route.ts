import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { createServiceClient } from "@/lib/supabase/server";

type InviteRole = "provider" | "admin";

function isInviteRole(value: string): value is InviteRole {
  return value === "provider" || value === "admin";
}

export async function POST(request: NextRequest) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (result.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isInviteRole(role)) {
    return NextResponse.json({ error: "Role must be provider or admin" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { error: inviteRowError } = await admin.from("invites").insert({
    email,
    org_id: result.user.orgId,
    role,
    invited_by: result.user.userId,
  });

  if (inviteRowError) {
    return NextResponse.json({ error: inviteRowError.message }, { status: 500 });
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
