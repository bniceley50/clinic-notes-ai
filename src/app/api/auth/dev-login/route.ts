/**
 * GET /api/auth/dev-login
 *
 * Local development shortcut that creates or finds a sanitized test user,
 * ensures the user has an org/profile, mints the app session cookie, and
 * redirects to the app root.
 *
 * This route is gated by ALLOW_DEV_LOGIN=1 + NODE_ENV=development and must
 * never be reachable in production.
 */

import { NextResponse, type NextRequest } from "next/server";
import { defaultPracticeId, isDevLoginAllowed } from "@/lib/config";
import { createSessionCookie } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { SessionRole } from "@/lib/auth/types";
import { withLogging } from "@/lib/logger";

const DEV_LOGIN_EMAIL = "dev-login@example.com";
const DEV_LOGIN_NAME = "Dev Login";
const DEV_LOGIN_ORG = "Clinic Notes AI Dev Practice";

async function findDevUser() {
  const admin = createServiceClient();
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const existing = data.users.find((user) => user.email === DEV_LOGIN_EMAIL);
    if (existing) {
      return existing;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function getOrCreateDevUser() {
  const admin = createServiceClient();
  const existing = await findDevUser();

  if (existing) {
    return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEV_LOGIN_EMAIL,
    password: `DevLogin-${globalThis.crypto.randomUUID()}!aA1`,
    email_confirm: true,
    user_metadata: {
      display_name: DEV_LOGIN_NAME,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create dev auth user");
  }

  return data.user;
}

async function getOrCreateDevOrg() {
  const admin = createServiceClient();
  const configuredOrgId = defaultPracticeId();

  const { data: existingConfiguredOrg } = await admin
    .from("orgs")
    .select("id")
    .eq("id", configuredOrgId)
    .maybeSingle();

  if (existingConfiguredOrg) {
    return existingConfiguredOrg.id;
  }

  const { data: createdOrg, error } = await admin
    .from("orgs")
    .insert({
      id: configuredOrgId,
      name: DEV_LOGIN_ORG,
    })
    .select("id")
    .single();

  if (error || !createdOrg) {
    throw new Error(error?.message ?? "Failed to create dev org");
  }

  return createdOrg.id;
}

async function getOrCreateDevProfile(userId: string) {
  const admin = createServiceClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingProfile) {
    return {
      orgId: existingProfile.org_id,
      role: existingProfile.role as SessionRole,
    };
  }

  const orgId = await getOrCreateDevOrg();
  const role: SessionRole = "provider";

  const { error } = await admin.from("profiles").insert({
    user_id: userId,
    org_id: orgId,
    display_name: DEV_LOGIN_NAME,
    role,
  });

  if (error) {
    throw new Error(`Failed to create dev profile: ${error.message}`);
  }

  return { orgId, role };
}

export const GET = withLogging(async (request: NextRequest) => {
  if (!isDevLoginAllowed()) {
    return NextResponse.json({ error: "Dev login is disabled" }, { status: 403 });
  }

  try {
    const user = await getOrCreateDevUser();
    const profile = await getOrCreateDevProfile(user.id);

    const cookie = await createSessionCookie({
      sub: user.id,
      email: user.email ?? DEV_LOGIN_EMAIL,
      practiceId: profile.orgId,
      role: profile.role,
    });

    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create dev session";

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
