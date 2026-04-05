import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "../../lib/auth/loader";

const {
  callOrder,
  mockCreateServiceClient,
  sessionState,
} = vi.hoisted(() => {
  const order: string[] = [];
  const sessionRow: {
    id: string;
    org_id: string;
    created_by: string;
    patient_label: string | null;
    session_type: string;
    status: string;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    deleted_at: string | null;
  } = {
    id: "session-1",
    org_id: "org-1",
    created_by: "user-1",
    patient_label: "Patient One",
    session_type: "general",
    status: "active",
    created_at: "2026-03-15T09:00:00.000Z",
    updated_at: "2026-03-15T09:00:00.000Z",
    completed_at: null,
    deleted_at: null,
  };

  const mockSessionMaybeSingle = vi.fn(async () => {
    order.push("session.load");
    return { data: { ...sessionRow }, error: null };
  });

  const makeUpdateChain = (label: string, onUpdate?: (values: Record<string, unknown>) => void) =>
    vi.fn((values: Record<string, unknown>) => ({
      eq: () => ({
        eq: () => ({
          is: async () => {
            order.push(label);
            onUpdate?.(values);
            return { error: null };
          },
        }),
      }),
    }));

  const mockNotesUpdate = makeUpdateChain("notes.soft-delete");
  const mockTranscriptsUpdate = makeUpdateChain("transcripts.soft-delete");
  const mockExtractionsUpdate = makeUpdateChain("extractions.soft-delete");
  const mockJobsUpdate = makeUpdateChain("jobs.soft-delete");
  const mockConsentsUpdate = makeUpdateChain("consents.soft-delete");
  const mockSessionUpdate = makeUpdateChain("session.soft-delete", (values) => {
    sessionRow.deleted_at = values.deleted_at as string;
  });

  const mockCreateServiceClient = vi.fn(() => ({
    from: (table: string) => {
      switch (table) {
        case "sessions":
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: mockSessionMaybeSingle,
                }),
              }),
            }),
            update: mockSessionUpdate,
          };
        case "notes":
          return { update: mockNotesUpdate };
        case "transcripts":
          return { update: mockTranscriptsUpdate };
        case "carelogic_field_extractions":
          return { update: mockExtractionsUpdate };
        case "jobs":
          return { update: mockJobsUpdate };
        case "session_consents":
          return { update: mockConsentsUpdate };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
  }));

  return {
    callOrder: order,
    mockCreateServiceClient,
    sessionState: {
      row: sessionRow,
      mockSessionMaybeSingle,
      mockNotesUpdate,
      mockTranscriptsUpdate,
      mockExtractionsUpdate,
      mockJobsUpdate,
      mockConsentsUpdate,
      mockSessionUpdate,
    },
  };
});

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { softDeleteSession } from "../../lib/sessions/queries";

const testUser: AppUser = {
  userId: "user-1",
  orgId: "org-1",
  role: "provider",
  email: "provider@example.com",
  profile: {
    id: "profile-1",
    user_id: "user-1",
    org_id: "org-1",
    display_name: "Provider One",
    role: "provider",
    created_at: "2026-03-15T10:00:00.000Z",
  },
  org: {
    id: "org-1",
    name: "Org One",
    created_at: "2026-03-15T10:00:00.000Z",
  },
};

describe("softDeleteSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    sessionState.row.deleted_at = null;
  });

  it("marks the session and child rows as deleted without removing storage artifacts", async () => {
    const result = await softDeleteSession(testUser, "session-1");

    expect(result).toMatchObject({
      id: "session-1",
      org_id: "org-1",
      deleted_at: expect.any(String),
    });
    expect(callOrder).toEqual([
      "session.load",
      "notes.soft-delete",
      "transcripts.soft-delete",
      "extractions.soft-delete",
      "jobs.soft-delete",
      "consents.soft-delete",
      "session.soft-delete",
    ]);
    expect(sessionState.mockNotesUpdate).toHaveBeenCalledWith({
      deleted_at: result.deleted_at,
    });
    expect(sessionState.mockTranscriptsUpdate).toHaveBeenCalledWith({
      deleted_at: result.deleted_at,
    });
    expect(sessionState.mockExtractionsUpdate).toHaveBeenCalledWith({
      deleted_at: result.deleted_at,
    });
    expect(sessionState.mockJobsUpdate).toHaveBeenCalledWith({
      deleted_at: result.deleted_at,
    });
    expect(sessionState.mockConsentsUpdate).toHaveBeenCalledWith({
      deleted_at: result.deleted_at,
    });
    expect(sessionState.mockSessionUpdate).toHaveBeenCalledWith({
      deleted_at: result.deleted_at,
    });
  });

  it("returns the current row without writes when the session is already soft-deleted", async () => {
    sessionState.row.deleted_at = "2026-03-29T12:00:00.000Z";

    const result = await softDeleteSession(testUser, "session-1");

    expect(result.deleted_at).toBe("2026-03-29T12:00:00.000Z");
    expect(callOrder).toEqual(["session.load"]);
    expect(sessionState.mockNotesUpdate).not.toHaveBeenCalled();
    expect(sessionState.mockTranscriptsUpdate).not.toHaveBeenCalled();
    expect(sessionState.mockExtractionsUpdate).not.toHaveBeenCalled();
    expect(sessionState.mockJobsUpdate).not.toHaveBeenCalled();
    expect(sessionState.mockConsentsUpdate).not.toHaveBeenCalled();
    expect(sessionState.mockSessionUpdate).not.toHaveBeenCalled();
  });
});
