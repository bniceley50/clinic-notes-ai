import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockLoadCurrentUser,
  mockUpdateMySession,
  mockCheckRateLimit,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockUpdateMySession: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/sessions/queries", () => ({
  deleteSessionCascade: vi.fn(),
  getMySession: vi.fn(),
  updateMySession: mockUpdateMySession,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: <T>(handler: T) => handler,
}));

import { PATCH } from "@/app/api/sessions/[sessionId]/route";

const authenticatedResult = {
  status: "authenticated" as const,
  user: {
    userId: "user-1",
    orgId: "org-1",
    role: "provider",
    email: "clinician@example.com",
    profile: {
      id: "profile-1",
      user_id: "user-1",
      org_id: "org-1",
      display_name: "Jane Doe",
      role: "provider",
      created_at: "2026-03-15T12:00:00.000Z",
    },
    org: {
      id: "org-1",
      name: "Test Org",
      created_at: "2026-03-15T12:00:00.000Z",
    },
  },
};

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/sessions/session-1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-vercel-id": "session-update-request-id",
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/sessions/[sessionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockUpdateMySession.mockResolvedValue({
      data: {
        id: "session-1",
        org_id: "org-1",
        created_by: "user-1",
        patient_label: "Updated Patient",
        session_type: "general",
        status: "completed",
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-22T10:00:00.000Z",
        completed_at: "2026-03-22T10:00:00.000Z",
      },
      error: null,
    });
  });

  it("writes a session.updated audit event after a successful patch", async () => {
    const response = await PATCH(
      makeRequest({
        patient_label: "Updated Patient",
        status: "completed",
      }) as never,
      {
        params: Promise.resolve({ sessionId: "session-1" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateMySession).toHaveBeenCalledWith(
      authenticatedResult.user,
      "session-1",
      {
        patient_label: "Updated Patient",
        status: "completed",
      },
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      sessionId: "session-1",
      action: "session.updated",
      requestId: "session-update-request-id",
      metadata: {
        updated_fields: ["patient_label", "status"],
      },
    });
    expect(payload).toEqual({
      session: {
        id: "session-1",
        org_id: "org-1",
        created_by: "user-1",
        patient_label: "Updated Patient",
        session_type: "general",
        status: "completed",
        created_at: "2026-03-21T10:00:00.000Z",
        updated_at: "2026-03-22T10:00:00.000Z",
        completed_at: "2026-03-22T10:00:00.000Z",
      },
    });
  });
});
