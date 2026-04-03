import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockIsDevLoginAllowed,
  mockCreateServiceClient,
  serviceState,
} = vi.hoisted(() => {
  const state = {
    profileReads: [] as Array<{ data: { org_id: string; role: string } | null }>,
    invite: null as { id: string; org_id: string; role: string } | null,
    newOrg: null as { id: string } | null,
    profileInsertError: null as { code?: string; message?: string } | null,
    inviteUpdateCalls: [] as Array<Record<string, unknown>>,
    insertedProfiles: [] as Array<Record<string, unknown>>,
    insertedOrgs: [] as Array<Record<string, unknown>>,
  };

  const mockCreateServiceClient = vi.fn(() => ({
    from: (table: string) => {
      switch (table) {
        case "profiles":
          return {
            select: () => ({
              eq: () => ({
                single: async () => {
                  const next = state.profileReads.shift() ?? { data: null };
                  return { data: next.data, error: null };
                },
              }),
            }),
            insert: async (values: Record<string, unknown>) => {
              state.insertedProfiles.push(values);
              return { error: state.profileInsertError };
            },
          };
        case "invites":
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  single: async () => ({
                    data: state.invite,
                    error: null,
                  }),
                }),
              }),
            }),
            update: (values: Record<string, unknown>) => ({
              eq: async () => {
                state.inviteUpdateCalls.push(values);
                return { error: null };
              },
            }),
          };
        case "orgs":
          return {
            insert: (values: Record<string, unknown>) => {
              state.insertedOrgs.push(values);
              return {
                select: () => ({
                  single: async () => ({
                    data: state.newOrg,
                    error: state.newOrg ? null : { message: "org insert failed" },
                  }),
                }),
              };
            },
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
  }));

  return {
    mockIsDevLoginAllowed: vi.fn(),
    mockCreateServiceClient,
    serviceState: state,
  };
});

vi.mock("@/lib/config", () => ({
  isDevLoginAllowed: mockIsDevLoginAllowed,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { resolveUserProfileGlobally } from "@/lib/auth/provisioning";

describe("resolveUserProfileGlobally", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDevLoginAllowed.mockReturnValue(false);
    serviceState.profileReads = [];
    serviceState.invite = null;
    serviceState.newOrg = null;
    serviceState.profileInsertError = null;
    serviceState.inviteUpdateCalls = [];
    serviceState.insertedProfiles = [];
    serviceState.insertedOrgs = [];
  });

  it("returns the concurrent winner profile when invite provisioning hits a unique violation", async () => {
    serviceState.profileReads = [
      { data: null },
      { data: { org_id: "org-1", role: "provider" } },
    ];
    serviceState.invite = {
      id: "invite-1",
      org_id: "org-1",
      role: "provider",
    };
    serviceState.profileInsertError = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    };

    const result = await resolveUserProfileGlobally({
      id: "user-1",
      email: "clinician@example.com",
    } as never);

    expect(result).toEqual({
      orgId: "org-1",
      role: "provider",
      errorCode: null,
    });
    expect(serviceState.insertedProfiles).toEqual([
      {
        user_id: "user-1",
        org_id: "org-1",
        display_name: "clinician@example.com",
        role: "provider",
      },
    ]);
    expect(serviceState.inviteUpdateCalls).toEqual([]);
  });

  it("returns the concurrent winner profile when dev provisioning hits a unique violation", async () => {
    mockIsDevLoginAllowed.mockReturnValue(true);
    serviceState.profileReads = [
      { data: null },
      { data: { org_id: "org-existing", role: "provider" } },
    ];
    serviceState.newOrg = { id: "org-new" };
    serviceState.profileInsertError = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    };

    const result = await resolveUserProfileGlobally({
      id: "user-1",
      email: "dev@example.com",
    } as never);

    expect(result).toEqual({
      orgId: "org-existing",
      role: "provider",
      errorCode: null,
    });
    expect(serviceState.insertedOrgs).toEqual([
      { name: "dev@example.com's practice" },
    ]);
    expect(serviceState.insertedProfiles).toEqual([
      {
        user_id: "user-1",
        org_id: "org-new",
        display_name: "dev@example.com",
        role: "provider",
      },
    ]);
  });

  it("returns bootstrap_failed when a non-unique profile insert error occurs", async () => {
    serviceState.profileReads = [{ data: null }];
    serviceState.invite = {
      id: "invite-1",
      org_id: "org-1",
      role: "provider",
    };
    serviceState.profileInsertError = {
      code: "50000",
      message: "write failed",
    };

    const result = await resolveUserProfileGlobally({
      id: "user-1",
      email: "clinician@example.com",
    } as never);

    expect(result).toEqual({
      orgId: null,
      role: null,
      errorCode: "bootstrap_failed",
    });
  });
});
