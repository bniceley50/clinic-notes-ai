import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAppUser,
  mockCreateSession,
  mockRedirect,
} = vi.hoisted(() => ({
  mockRequireAppUser: vi.fn(),
  mockCreateSession: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  requireAppUser: mockRequireAppUser,
}));

vi.mock("@/lib/sessions/queries", () => ({
  createSession: mockCreateSession,
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { createSessionAction } from "@/lib/sessions/actions";

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

function makeFormData(
  patientLabel = "Chart 1234",
  sessionType = "general",
): FormData {
  const formData = new FormData();
  formData.set("patient_label", patientLabel);
  formData.set("session_type", sessionType);
  return formData;
}

describe("createSessionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAppUser.mockResolvedValue(providerUser);
  });

  it("returns Invalid request when patient_label is missing", async () => {
    const formData = new FormData();
    formData.set("session_type", "general");

    const result = await createSessionAction({ error: null }, formData);

    expect(result).toEqual({ error: "Invalid request." });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns Invalid request when session_type is unsupported", async () => {
    const result = await createSessionAction(
      { error: null },
      makeFormData("Chart 1234", "individual"),
    );

    expect(result).toEqual({ error: "Invalid request." });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
