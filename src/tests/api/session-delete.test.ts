import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetSessionForOrg,
  mockDeleteSessionCascade,
  mockCheckRateLimit,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetSessionForOrg: vi.fn(),
  mockDeleteSessionCascade: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("../../lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("../../lib/sessions/queries", () => ({
  getSessionForOrg: mockGetSessionForOrg,
  deleteSessionCascade: mockDeleteSessionCascade,
  getMySession: vi.fn(),
  updateMySession: vi.fn(),
}));

vi.mock("../../lib/rate-limit", () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("../../lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("../../lib/logger", () => ({
  withLogging: <T>(handler: T) => handler,
}));

import { DELETE } from "../../app/api/sessions/[sessionId]/route";

const providerAuth = {
  status: "authenticated" as const,
  user: {
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
  },
};

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/sessions/session-1", {
    method: "DELETE",
    headers: {
      "x-vercel-id": "session-delete-request-id",
    },
  });
}

describe("DELETE /api/sessions/[sessionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(providerAuth);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetSessionForOrg.mockResolvedValue({
      data: {
        id: "session-1",
        org_id: "org-1",
        created_by: "user-1",
        patient_label: "Patient One",
        session_type: "general",
        status: "active",
        created_at: "2026-03-15T09:00:00.000Z",
        updated_at: "2026-03-15T09:00:00.000Z",
        completed_at: null,
      },
      error: null,
    });
    mockDeleteSessionCascade.mockResolvedValue({ deleted: true });
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockLoadCurrentUser.mockResolvedValue({ status: "no_session" });

    const response = await DELETE(makeRequest() as never, {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Unauthorized" });
    expect(mockGetSessionForOrg).not.toHaveBeenCalled();
  });

  it("allows a provider to delete their own session", async () => {
    const response = await DELETE(makeRequest() as never, {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ deleted: true });
    expect(mockGetSessionForOrg).toHaveBeenCalledWith("org-1", "session-1");
    expect(mockDeleteSessionCascade).toHaveBeenCalledWith("session-1", "org-1");
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      sessionId: "session-1",
      action: "session.deleted",
      requestId: "session-delete-request-id",
      metadata: {
        deleted_by_role: "provider",
        deleted_session_owner: "user-1",
      },
    });
  });

  it("allows an admin to delete any session in the org", async () => {
    mockLoadCurrentUser.mockResolvedValue({
      ...providerAuth,
      user: {
        ...providerAuth.user,
        userId: "admin-1",
        role: "admin",
        profile: {
          ...providerAuth.user.profile,
          user_id: "admin-1",
          role: "admin",
        },
      },
    });
    mockGetSessionForOrg.mockResolvedValue({
      data: {
        id: "session-1",
        org_id: "org-1",
        created_by: "provider-2",
        patient_label: "Patient Two",
        session_type: "general",
        status: "active",
        created_at: "2026-03-15T09:00:00.000Z",
        updated_at: "2026-03-15T09:00:00.000Z",
        completed_at: null,
      },
      error: null,
    });

    const response = await DELETE(makeRequest() as never, {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockDeleteSessionCascade).toHaveBeenCalledWith("session-1", "org-1");
  });

  it("returns 403 when a provider tries to delete another provider's session in the same org", async () => {
    mockGetSessionForOrg.mockResolvedValue({
      data: {
        id: "session-1",
        org_id: "org-1",
        created_by: "other-user",
        patient_label: "Patient Two",
        session_type: "general",
        status: "active",
        created_at: "2026-03-15T09:00:00.000Z",
        updated_at: "2026-03-15T09:00:00.000Z",
        completed_at: null,
      },
      error: null,
    });

    const response = await DELETE(makeRequest() as never, {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: "Forbidden" });
    expect(mockDeleteSessionCascade).not.toHaveBeenCalled();
  });

  it("returns 404 when the session is outside the authenticated org", async () => {
    mockGetSessionForOrg.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await DELETE(makeRequest() as never, {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Not found" });
    expect(mockDeleteSessionCascade).not.toHaveBeenCalled();
  });
});
