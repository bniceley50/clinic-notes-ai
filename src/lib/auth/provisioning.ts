import type { User } from "@supabase/supabase-js";
import { isDevLoginAllowed } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/server";
import type { SessionRole } from "@/lib/auth/types";

export type ProvisioningErrorCode = "no_invite" | "bootstrap_failed";
const PG_UNIQUE_VIOLATION = "23505";

async function readExistingProfile(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const { data } = await admin
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", userId)
    .single();

  return data ?? null;
}

export async function resolveUserProfile(user: User) {
  const admin = createServiceClient();

  const profile = await readExistingProfile(admin, user.id);
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
      if (profileError.code === PG_UNIQUE_VIOLATION) {
        const raceProfile = await readExistingProfile(admin, user.id);
        if (raceProfile) {
          return {
            orgId: raceProfile.org_id,
            role: raceProfile.role as SessionRole,
            errorCode: null as ProvisioningErrorCode | null,
          };
        }
      }

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
    if (profileError.code === PG_UNIQUE_VIOLATION) {
      const raceProfile = await readExistingProfile(admin, user.id);
      if (raceProfile) {
        return {
          orgId: raceProfile.org_id,
          role: raceProfile.role as SessionRole,
          errorCode: null as ProvisioningErrorCode | null,
        };
      }
    }

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
