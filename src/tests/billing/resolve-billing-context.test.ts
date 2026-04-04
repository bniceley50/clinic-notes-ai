import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authState,
  billingState,
  mockRequireAppUser,
  mockCreateServerClient,
  mockCreateServiceClient,
} = vi.hoisted(() => {
  const state = {
    user: {
      userId: "user-1",
      orgId: "org-1",
      role: "provider",
      email: "clinician@example.com",
      profile: {
        id: "profile-1",
        user_id: "user-1",
        org_id: "org-1",
        display_name: "Clinician One",
        role: "provider",
        created_at: "2026-04-03T12:00:00.000Z",
      },
      org: {
        id: "org-1",
        name: "Org One",
        created_at: "2026-04-03T12:00:00.000Z",
      },
    },
    session: {
      id: "session-1",
      org_id: "org-1",
      created_by: "user-1",
      patient_label: "Patient A",
      psychotherapy_addon_present: false,
      psychotherapy_addon_source: null,
      psychotherapy_addon_changed_at: null,
      deleted_at: null,
    } as Record<string, unknown> | null,
    sessionError: null as { message: string } | null,
    profile: {
      user_id: "user-1",
      org_id: "org-1",
      rendering_provider_npi: "1234567890",
      billing_group_id: "billing-org-1",
    } as Record<string, unknown> | null,
    profileError: null as { message: string } | null,
    patientStatus: "new" as "new" | "established" | string,
    rpcError: null as { message: string } | null,
    rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  };

  const billing = {
    latestContext: null as Record<string, unknown> | null,
    latestContextError: null as { message: string } | null,
    runReference: null as Record<string, unknown> | null,
    runReferenceError: null as { message: string } | null,
    insertedPayloads: [] as Array<Record<string, unknown>>,
    updatedPayloads: [] as Array<{ payload: Record<string, unknown>; where: Record<string, unknown> }>,
    insertError: null as { message: string } | null,
    updateError: null as { message: string } | null,
    nextInsertId: 1,
  };

  const createAuthClient = () => ({
    from: (table: string) => {
      switch (table) {
        case "sessions":
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    is: () => ({
                      maybeSingle: async () => ({
                        data: state.session,
                        error: state.sessionError,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        case "profiles":
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: state.profile,
                    error: state.profileError,
                  }),
                }),
              }),
            }),
          };
        default:
          throw new Error(`Unexpected auth table ${table}`);
      }
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      return {
        data: state.patientStatus,
        error: state.rpcError,
      };
    },
  });

  const createBillingSchemaClient = () => ({
    from: (table: string) => {
      switch (table) {
        case "session_billing_context":
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: billing.latestContext,
                        error: billing.latestContextError,
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: (payload: Record<string, unknown>) => ({
              select: () => ({
                single: async () => {
                  billing.insertedPayloads.push(payload);
                  if (billing.insertError) {
                    return { data: null, error: billing.insertError };
                  }
                  const id = `context-insert-${billing.nextInsertId++}`;
                  billing.latestContext = {
                    id,
                    org_id: payload.org_id,
                    created_at: payload.resolved_at,
                  };
                  return {
                    data: { id },
                    error: null,
                  };
                },
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              const where: Record<string, unknown> = {};
              return {
                eq: (column: string, value: unknown) => {
                  where[column] = value;
                  return {
                    eq: (column2: string, value2: unknown) => {
                      where[column2] = value2;
                      return {
                        select: () => ({
                          single: async () => {
                            billing.updatedPayloads.push({ payload, where: { ...where } });
                            if (billing.updateError) {
                              return { data: null, error: billing.updateError };
                            }
                            return {
                              data: { id: where.id },
                              error: null,
                            };
                          },
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        case "em_scoring_run":
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: billing.runReference,
                    error: billing.runReferenceError,
                  }),
                }),
              }),
            }),
          };
        default:
          throw new Error(`Unexpected billing table ${table}`);
      }
    },
  });

  return {
    authState: state,
    billingState: billing,
    mockRequireAppUser: vi.fn(async () => state.user),
    mockCreateServerClient: vi.fn(async () => createAuthClient()),
    mockCreateServiceClient: vi.fn(() => ({
      schema: vi.fn((schemaName: string) => {
        if (schemaName !== "billing") {
          throw new Error(`Unexpected schema ${schemaName}`);
        }
        return createBillingSchemaClient();
      }),
    })),
  };
});

vi.mock("@/lib/auth/loader", () => ({
  requireAppUser: mockRequireAppUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
  createServiceClient: mockCreateServiceClient,
}));

import {
  BillingContextAuthError,
  BillingProfileIncompleteError,
  resolveBillingContext,
  shouldInvalidateScoringOnPsychotherapyAddonChange,
} from "@/lib/billing/resolve-billing-context";

describe("resolveBillingContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = {
      userId: "user-1",
      orgId: "org-1",
      role: "provider",
      email: "clinician@example.com",
      profile: {
        id: "profile-1",
        user_id: "user-1",
        org_id: "org-1",
        display_name: "Clinician One",
        role: "provider",
        created_at: "2026-04-03T12:00:00.000Z",
      },
      org: {
        id: "org-1",
        name: "Org One",
        created_at: "2026-04-03T12:00:00.000Z",
      },
    };
    authState.session = {
      id: "session-1",
      org_id: "org-1",
      created_by: "user-1",
      patient_label: "Patient A",
      psychotherapy_addon_present: false,
      psychotherapy_addon_source: null,
      psychotherapy_addon_changed_at: null,
      deleted_at: null,
    };
    authState.sessionError = null;
    authState.profile = {
      user_id: "user-1",
      org_id: "org-1",
      rendering_provider_npi: "1234567890",
      billing_group_id: "billing-org-1",
    };
    authState.profileError = null;
    authState.patientStatus = "new";
    authState.rpcError = null;
    authState.rpcCalls = [];

    billingState.latestContext = null;
    billingState.latestContextError = null;
    billingState.runReference = null;
    billingState.runReferenceError = null;
    billingState.insertedPayloads = [];
    billingState.updatedPayloads = [];
    billingState.insertError = null;
    billingState.updateError = null;
    billingState.nextInsertId = 1;
  });

  it("resolves a new patient and creates a billing context when none exists", async () => {
    authState.patientStatus = "new";

    const result = await resolveBillingContext("session-1");

    expect(result).toEqual({
      contextId: "context-insert-1",
      patientStatus: "new",
    });
    expect(authState.rpcCalls).toEqual([
      {
        fn: "resolve_patient_status_for_em",
        args: {
          p_patient_label: "Patient A",
          p_org_id: "org-1",
          p_exclude_session_id: "session-1",
        },
      },
    ]);
    expect(billingState.insertedPayloads).toHaveLength(1);
    expect(billingState.insertedPayloads[0]).toEqual(
      expect.objectContaining({
        session_id: "session-1",
        rendering_provider_id: "user-1",
        billing_group_id: "billing-org-1",
        patient_status_for_em: "new",
        status_source: "system_derived",
        status_basis_code: "no_prior_visit_found",
      }),
    );
  });

  it("resolves an established patient when the lookback RPC returns established", async () => {
    authState.patientStatus = "established";

    const result = await resolveBillingContext("session-1");

    expect(result.patientStatus).toBe("established");
    expect(billingState.insertedPayloads[0]).toEqual(
      expect.objectContaining({
        patient_status_for_em: "established",
        status_basis_code: "prior_visit_same_group_same_specialty",
      }),
    );
  });

  it("treats soft-deleted prior sessions as new when the lookback RPC returns new", async () => {
    authState.patientStatus = "new";

    const result = await resolveBillingContext("session-1");

    expect(result.patientStatus).toBe("new");
  });

  it("updates the existing context when one exists without a scoring run reference", async () => {
    billingState.latestContext = {
      id: "context-existing-1",
      org_id: "org-1",
      created_at: "2026-04-03T12:30:00.000Z",
    };
    billingState.runReference = null;

    const result = await resolveBillingContext("session-1");

    expect(result).toEqual({
      contextId: "context-existing-1",
      patientStatus: "new",
    });
    expect(billingState.insertedPayloads).toHaveLength(0);
    expect(billingState.updatedPayloads).toHaveLength(1);
    expect(billingState.updatedPayloads[0]).toEqual(
      expect.objectContaining({
        where: {
          id: "context-existing-1",
          org_id: "org-1",
        },
      }),
    );
  });

  it("inserts a new context row when the latest context already has a scoring run reference", async () => {
    billingState.latestContext = {
      id: "context-existing-1",
      org_id: "org-1",
      created_at: "2026-04-03T12:30:00.000Z",
    };
    billingState.runReference = { id: "run-1" };

    const result = await resolveBillingContext("session-1");

    expect(result).toEqual({
      contextId: "context-insert-1",
      patientStatus: "new",
    });
    expect(billingState.insertedPayloads).toHaveLength(1);
    expect(billingState.updatedPayloads).toHaveLength(0);
  });

  it("throws BillingContextAuthError when the session belongs to a different org", async () => {
    authState.session = null;

    await expect(resolveBillingContext("session-1")).rejects.toBeInstanceOf(
      BillingContextAuthError,
    );
  });

  it("throws BillingProfileIncompleteError when both billing profile fields are null", async () => {
    authState.profile = {
      user_id: "user-1",
      org_id: "org-1",
      rendering_provider_npi: null,
      billing_group_id: null,
    };

    await expect(resolveBillingContext("session-1")).rejects.toBeInstanceOf(
      BillingProfileIncompleteError,
    );
  });

  it("does not create duplicate contexts under repeated calls for the same session", async () => {
    const first = await resolveBillingContext("session-1");
    const second = await resolveBillingContext("session-1");

    expect(first).toEqual({
      contextId: "context-insert-1",
      patientStatus: "new",
    });
    expect(second).toEqual({
      contextId: "context-insert-1",
      patientStatus: "new",
    });
    expect(billingState.insertedPayloads).toHaveLength(1);
    expect(billingState.updatedPayloads).toHaveLength(1);
  });

  it("does not create duplicate invalidation rows for repeated equivalent toggles", () => {
    expect(
      shouldInvalidateScoringOnPsychotherapyAddonChange(false, false),
    ).toBe(false);
    expect(
      shouldInvalidateScoringOnPsychotherapyAddonChange(true, true),
    ).toBe(false);
    expect(
      shouldInvalidateScoringOnPsychotherapyAddonChange(false, true),
    ).toBe(true);
  });

  it("denies resolving context for a session not owned by the authenticated clinician", async () => {
    authState.session = null;

    await expect(resolveBillingContext("session-1")).rejects.toBeInstanceOf(
      BillingContextAuthError,
    );
  });
});
