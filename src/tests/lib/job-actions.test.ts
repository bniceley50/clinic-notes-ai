import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAppUser,
  mockGetMySession,
  mockCreateJob,
  mockRedirect,
} = vi.hoisted(() => ({
  mockRequireAppUser: vi.fn(),
  mockGetMySession: vi.fn(),
  mockCreateJob: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  requireAppUser: mockRequireAppUser,
}));

vi.mock("@/lib/sessions/queries", () => ({
  getMySession: mockGetMySession,
}));

vi.mock("@/lib/jobs/queries", () => ({
  createJob: mockCreateJob,
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { createJobAction } from "@/lib/jobs/actions";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

const providerUser = {
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
    created_at: "2026-04-01T00:00:00.000Z",
  },
  org: {
    id: "org-1",
    name: "Org One",
    created_at: "2026-04-01T00:00:00.000Z",
  },
};

const adminUser = {
  ...providerUser,
  userId: "admin-1",
  role: "admin",
  profile: {
    ...providerUser.profile,
    id: "profile-admin-1",
    user_id: "admin-1",
    role: "admin",
  },
  email: "admin@example.com",
};

function makeFormData(
  sessionId = SESSION_ID,
  noteType = "soap",
): FormData {
  const formData = new FormData();
  formData.set("session_id", sessionId);
  formData.set("note_type", noteType);
  return formData;
}

describe("createJobAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a session owned by another user in the same org", async () => {
    mockRequireAppUser.mockResolvedValue(providerUser);
    mockGetMySession.mockResolvedValue({ data: null, error: "Not found" });

    const result = await createJobAction(
      { error: null },
      makeFormData("22222222-2222-4222-8222-222222222222"),
    );

    expect(mockGetMySession).toHaveBeenCalledWith(
      providerUser,
      "22222222-2222-4222-8222-222222222222",
    );
    expect(mockCreateJob).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toEqual({ error: "Session not found or access denied." });
  });

  it("allows admins to create jobs for any session in their org", async () => {
    mockRequireAppUser.mockResolvedValue(adminUser);
    mockGetMySession.mockResolvedValue({
      data: {
        id: "session-2",
        org_id: "org-1",
        created_by: "provider-2",
        patient_label: "Patient A",
        session_type: "general",
        status: "active",
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        completed_at: null,
        deleted_at: null,
      },
      error: null,
    });
    mockCreateJob.mockResolvedValue({
      data: { id: "job-1" },
      error: null,
    });

    await createJobAction(
      { error: null },
      makeFormData("22222222-2222-4222-8222-222222222222", "dap"),
    );

    expect(mockGetMySession).toHaveBeenCalledWith(
      adminUser,
      "22222222-2222-4222-8222-222222222222",
    );
    expect(mockCreateJob).toHaveBeenCalledWith(adminUser, {
      session_id: "22222222-2222-4222-8222-222222222222",
      note_type: "dap",
    });
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sessions/22222222-2222-4222-8222-222222222222",
    );
  });

  it("returns Invalid request for a non-UUID session_id", async () => {
    mockRequireAppUser.mockResolvedValue(providerUser);

    const result = await createJobAction(
      { error: null },
      makeFormData("session-2"),
    );

    expect(result).toEqual({ error: "Invalid request." });
    expect(mockGetMySession).not.toHaveBeenCalled();
    expect(mockCreateJob).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
