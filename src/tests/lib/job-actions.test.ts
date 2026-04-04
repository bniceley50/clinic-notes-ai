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

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { createJobAction } from "@/lib/jobs/actions";

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
  sessionId = "session-1",
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

    const result = await createJobAction({ error: null }, makeFormData("session-2"));

    expect(mockGetMySession).toHaveBeenCalledWith(providerUser, "session-2");
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

    await createJobAction({ error: null }, makeFormData("session-2", "dap"));

    expect(mockGetMySession).toHaveBeenCalledWith(adminUser, "session-2");
    expect(mockCreateJob).toHaveBeenCalledWith(adminUser, {
      session_id: "session-2",
      note_type: "dap",
    });
    expect(mockRedirect).toHaveBeenCalledWith("/sessions/session-2");
  });
});
