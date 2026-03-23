import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateClient,
  mockCreateSessionCookie,
  mockResolveUserProfile,
  mockWriteAuditLog,
  mockCheckRateLimit,
  mockSupabaseConfig,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateSessionCookie: vi.fn(),
  mockResolveUserProfile: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockSupabaseConfig: {
    getUser: vi.fn(),
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/config", () => ({
  supabaseUrl: vi.fn(() => "https://example.supabase.co"),
  supabaseAnonKey: vi.fn(() => "anon-key"),
}));

vi.mock("@/lib/auth/session", () => ({
  createSessionCookie: mockCreateSessionCookie,
}));

vi.mock("@/lib/auth/provisioning", () => ({
  resolveUserProfile: mockResolveUserProfile,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("@/lib/rate-limit", () => ({
  authLimit: { name: "auth-limit" },
  getIdentifier: vi.fn(() => "ip:127.0.0.1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { POST } from "@/app/api/auth/session/route";

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateClient.mockReturnValue({
      auth: mockSupabaseConfig,
    });
    mockCheckRateLimit.mockResolvedValue(null);
    mockCreateSessionCookie.mockResolvedValue(
      "cna_session=test-cookie; Path=/; HttpOnly",
    );
    mockResolveUserProfile.mockResolvedValue({
      orgId: "org-1",
      role: "provider",
      errorCode: null,
    });
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockSupabaseConfig.getUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "clinician@example.com",
        },
      },
      error: null,
    });
  });

  it("returns 200 and sets cna_session for a valid access token", async () => {
    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: "valid-token",
      }),
    });

    const response = await POST(request as never);

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(mockSupabaseConfig.getUser).toHaveBeenCalledWith("valid-token");
    expect(mockCreateSessionCookie).toHaveBeenCalledWith({
      sub: "00000000-0000-0000-0000-000000000001",
      email: "clinician@example.com",
      practiceId: "org-1",
      role: "provider",
    });
    expect(response.headers.get("set-cookie")).toContain("cna_session=test-cookie");
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "00000000-0000-0000-0000-000000000001",
      action: "auth.login",
    });
  });

  it("returns 401 for an invalid or expired access token", async () => {
    mockSupabaseConfig.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });

    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: "expired-token",
      }),
    });

    const response = await POST(request as never);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid or expired Supabase token",
    });
    expect(response.status).toBe(401);
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("returns 400 when access_token is missing", async () => {
    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request as never);

    await expect(response.json()).resolves.toEqual({
      error: "Missing access_token in request body",
    });
    expect(response.status).toBe(400);
    expect(mockSupabaseConfig.getUser).not.toHaveBeenCalled();
  });

  it("returns 403 when provisioning finds no invite", async () => {
    mockResolveUserProfile.mockResolvedValue({
      orgId: null,
      role: null,
      errorCode: "no_invite",
    });

    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: "valid-token",
      }),
    });

    const response = await POST(request as never);

    await expect(response.json()).resolves.toEqual({ error: "no_invite" });
    expect(response.status).toBe(403);
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("returns 429 when the auth rate limit is hit", async () => {
    const limitedResponse = new Response(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
    mockCheckRateLimit.mockResolvedValue(limitedResponse);

    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: "valid-token",
      }),
    });

    const response = await POST(request as never);

    await expect(response.json()).resolves.toEqual({ error: "Too many requests" });
    expect(response.status).toBe(429);
    expect(mockSupabaseConfig.getUser).not.toHaveBeenCalled();
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });
});
