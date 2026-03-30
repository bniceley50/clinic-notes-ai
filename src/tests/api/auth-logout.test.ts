import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockReadSessionFromCookieHeader,
  mockClearSessionCookie,
  mockRevokeSession,
  mockWriteAuditLog,
  mockSessionTtlSeconds,
  mockCheckRateLimit,
  mockGetIdentifier,
} = vi.hoisted(() => ({
  mockReadSessionFromCookieHeader: vi.fn(),
  mockClearSessionCookie: vi.fn(),
  mockRevokeSession: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockSessionTtlSeconds: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockGetIdentifier: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  readSessionFromCookieHeader: mockReadSessionFromCookieHeader,
  clearSessionCookie: mockClearSessionCookie,
}));

vi.mock("@/lib/auth/revocation", () => ({
  revokeSession: mockRevokeSession,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("@/lib/config", () => ({
  sessionTtlSeconds: mockSessionTtlSeconds,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: { name: "api-limit" },
  checkRateLimit: mockCheckRateLimit,
  getIdentifier: mockGetIdentifier,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { POST } from "../../app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearSessionCookie.mockReturnValue("cna_session=; Path=/; Max-Age=0");
    mockSessionTtlSeconds.mockReturnValue(28800);
    mockRevokeSession.mockResolvedValue(undefined);
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetIdentifier.mockReturnValue("ip:127.0.0.1");
  });

  it("clears the session and revokes the token for authenticated requests", async () => {
    mockReadSessionFromCookieHeader.mockResolvedValue({
      sub: "00000000-0000-0000-0000-000000000001",
      practiceId: "org-1",
      role: "provider",
      iat: 1,
      exp: 2,
      jti: "jti-1",
    });

    const request = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: "cna_session=test",
      },
    });

    const response = await POST(request as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(response.headers.get("set-cookie")).toContain("cna_session=");
    expect(mockGetIdentifier).toHaveBeenCalledWith(request, "00000000-0000-0000-0000-000000000001");
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      { name: "api-limit" },
      "ip:127.0.0.1",
    );
    expect(mockRevokeSession).toHaveBeenCalledWith("jti-1", 28800);
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "00000000-0000-0000-0000-000000000001",
      action: "auth.logout",
    });
  });

  it("handles unauthenticated requests gracefully", async () => {
    mockReadSessionFromCookieHeader.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });

    const response = await POST(request as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(response.headers.get("set-cookie")).toContain("cna_session=");
    expect(mockGetIdentifier).toHaveBeenCalledWith(request, null);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      { name: "api-limit" },
      "ip:127.0.0.1",
    );
    expect(mockRevokeSession).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("returns 429 and skips revocation when the logout rate limit is hit", async () => {
    mockReadSessionFromCookieHeader.mockResolvedValue({
      sub: "00000000-0000-0000-0000-000000000001",
      practiceId: "org-1",
      role: "provider",
      iat: 1,
      exp: 2,
      jti: "jti-1",
    });
    const limitedResponse = new Response(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
    mockCheckRateLimit.mockResolvedValue(limitedResponse);

    const request = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: "cna_session=test",
      },
    });

    const response = await POST(request as never);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Too many requests" });
    expect(mockGetIdentifier).toHaveBeenCalledWith(request, "00000000-0000-0000-0000-000000000001");
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      { name: "api-limit" },
      "ip:127.0.0.1",
    );
    expect(mockRevokeSession).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
    expect(mockClearSessionCookie).not.toHaveBeenCalled();
  });

  it("returns 503 and leaves the session cookie untouched when revocation fails", async () => {
    mockReadSessionFromCookieHeader.mockResolvedValue({
      sub: "00000000-0000-0000-0000-000000000001",
      practiceId: "org-1",
      role: "provider",
      iat: 1,
      exp: 2,
      jti: "jti-1",
    });
    mockRevokeSession.mockRejectedValue(new Error("Redis unavailable"));

    const request = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: "cna_session=test",
      },
    });

    const response = await POST(request as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Logout unavailable. Please try again.",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(mockGetIdentifier).toHaveBeenCalledWith(
      request,
      "00000000-0000-0000-0000-000000000001",
    );
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      { name: "api-limit" },
      "ip:127.0.0.1",
    );
    expect(mockRevokeSession).toHaveBeenCalledWith("jti-1", 28800);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
    expect(mockClearSessionCookie).not.toHaveBeenCalled();
  });
});
