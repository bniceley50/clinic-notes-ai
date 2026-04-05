import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockCreateSession,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockCreateSession: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/sessions/queries", () => ({
  createSession: mockCreateSession,
  listMySessions: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: <T>(handler: T) => handler,
  logError: vi.fn(),
}));

import { POST } from "@/app/api/sessions/route";

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

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
  });

  it("returns 400 with VALIDATION_ERROR when patient_label is missing", async () => {
    const response = await POST(
      makeRequest({ session_type: "general" }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request.",
      },
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("returns 400 with VALIDATION_ERROR when session_type is unsupported", async () => {
    const response = await POST(
      makeRequest({ patient_label: "Chart 1234", session_type: "individual" }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request.",
      },
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
