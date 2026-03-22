import "server-only";

/**
 * Server loader for resolving the current authenticated user's
 * full identity from the database.
 *
 * This is the canonical way to get a DB-backed user context on
 * any protected server page or API route. It bridges:
 *   - middleware-injected headers (x-user-id, x-org-id, x-user-role)
 *   - profiles table (display_name, role, org_id)
 *   - orgs table (org name)
 *
 * Handles the JWT org claim → org_id (DB) mapping via claims.ts.
 */

import { getCurrentUser } from "./server";
import { createServiceClient } from "@/lib/supabase/server";

export type ProfileRow = {
  id: string;
  user_id: string;
  org_id: string;
  display_name: string;
  role: string;
  created_at: string;
};

export type OrgRow = {
  id: string;
  name: string;
  created_at: string;
};

export type AppUser = {
  userId: string;
  orgId: string;
  role: string;
  email: string | undefined;
  profile: ProfileRow;
  org: OrgRow;
};

export type LoadResult =
  | { status: "authenticated"; user: AppUser }
  | { status: "no_session" }
  | { status: "no_profile"; userId: string; orgId: string }
  | { status: "no_org"; userId: string; orgId: string }
  | { status: "error"; message: string };

export async function loadCurrentUser(): Promise<LoadResult> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return { status: "no_session" };
  }

  const { userId, orgId } = sessionUser;
  const db = createServiceClient();

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, user_id, org_id, display_name, role, created_at")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .single();

  if (profileError || !profile) {
    return { status: "no_profile", userId, orgId };
  }

  const { data: org, error: orgError } = await db
    .from("orgs")
    .select("id, name, created_at")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return { status: "no_org", userId, orgId };
  }

  return {
    status: "authenticated",
    user: {
      userId,
      orgId,
      role: profile.role,
      email: sessionUser.email,
      profile: profile as ProfileRow,
      org: org as OrgRow,
    },
  };
}

export async function requireAppUser(): Promise<AppUser> {
  const result = await loadCurrentUser();
  if (result.status !== "authenticated") {
    throw new Error(`Auth loader failed: ${result.status}`);
  }
  return result.user;
}
