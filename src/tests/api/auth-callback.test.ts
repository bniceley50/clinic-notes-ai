import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateClient,
  mockCreateServiceClient,
  mockCreateSessionCookie,
  mockSupabaseConfig,
  mockAdminState,
  mockInviteEmailEq,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateServiceClient: vi.fn(),
  mockCreateSessionCookie: vi.fn(),
  mockSupabaseConfig: {
    exchangeCodeForSession: vi.fn(),
    verifyOtp: vi.fn(),
    getUser: vi.fn(),
  },
  mockAdminState: {
    profileSelectResult: {
      data: { org_id: "org-1", role: "provider" },
      error: null,
    } as {
      data: { org_id: string; role: string } | null;
      error: unknown;
    },
    inviteSelectResult: {
      data: null,
      error: null,
    } as {
      data: { id: string; org_id: string; role: string } | null;
      error: unknown;
    },
    profileInsertResult: {
      error: null,
    } as {
      error: unknown;
    },
    inviteUpdateResult: {
      error: null,
    } as {
      error: unknown;
    },
  },
  mockInviteEmailEq: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/config", () => ({
  supabaseUrl: vi.fn(() => "https://example.supabase.co"),
  supabaseAnonKey: vi.fn(() => "anon-key"),
  isDevLoginAllowed: vi.fn(() => false),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("@/lib/auth/session", () => ({
  createSessionCookie: mockCreateSessionCookie,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { GET, POST } from "../../app/api/auth/callback/route";

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateClient.mockReturnValue({
      auth: mockSupabaseConfig,
    });

    mockCreateServiceClient.mockReturnValue({
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  ...mockAdminState.profileSelectResult,
                }),
              }),
            }),
            insert: async () => ({
              ...mockAdminState.profileInsertResult,
            }),
          };
        }

        if (table === "invites") {
          return {
            select: () => ({
              eq: (column: string, value: string) => {
                mockInviteEmailEq(column, value);
                return {
                  is: () => ({
                    single: async () => ({
                      ...mockAdminState.inviteSelectResult,
                    }),
                  }),
                };
              },
            }),
            update: () => ({
              eq: async () => ({
                ...mockAdminState.inviteUpdateResult,
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    mockAdminState.profileSelectResult = {
      data: { org_id: "org-1", role: "provider" },
      error: null,
    };
    mockAdminState.inviteSelectResult = {
      data: null,
      error: null,
    };
    mockAdminState.profileInsertResult = {
      error: null,
    };
    mockAdminState.inviteUpdateResult = {
      error: null,
    };

    mockCreateSessionCookie.mockResolvedValue("cna_session=test-cookie; Path=/; HttpOnly");
    mockSupabaseConfig.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "clinician@example.com",
        },
      },
      error: null,
    });
    mockSupabaseConfig.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mockSupabaseConfig.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mockInviteEmailEq.mockReset();
  });

  it("redirects on a valid auth code exchange", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=valid-code&next=/dashboard",
    );

    const response = await GET(request as never);

    expect(mockSupabaseConfig.exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(mockCreateSessionCookie).toHaveBeenCalledWith({
      sub: "00000000-0000-0000-0000-000000000001",
      email: "clinician@example.com",
      practiceId: "org-1",
      role: "provider",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect(response.headers.get("set-cookie")).toContain("cna_session=test-cookie");
  });

  it("falls back to the default redirect for absolute next URLs", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=valid-code&next=https://evil.example/phish",
    );

    const response = await GET(request as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/sessions");
  });

  it("falls back to the default redirect for protocol-relative next URLs", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=valid-code&next=//evil.example/phish",
    );

    const response = await GET(request as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/sessions");
  });

  it("redirects to login when the auth code is invalid or expired", async () => {
    mockSupabaseConfig.exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid code" },
    });

    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=expired-code",
    );

    const response = await GET(request as never);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=invalid_code",
    );
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("bootstraps a first-time invited user and redirects to /sessions", async () => {
    mockAdminState.profileSelectResult = {
      data: null,
      error: { message: "not found" },
    };
    mockAdminState.inviteSelectResult = {
      data: { id: "invite-1", org_id: "org-2", role: "admin" },
      error: null,
    };

    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=valid-code",
    );

    const response = await GET(request as never);

    expect(mockCreateSessionCookie).toHaveBeenCalledWith({
      sub: "00000000-0000-0000-0000-000000000001",
      email: "clinician@example.com",
      practiceId: "org-2",
      role: "admin",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/sessions");
    expect(response.headers.get("set-cookie")).toContain("cna_session=test-cookie");
  });

  it("matches invites case-insensitively during first-time provisioning", async () => {
    mockAdminState.profileSelectResult = {
      data: null,
      error: { message: "not found" },
    };
    mockAdminState.inviteSelectResult = {
      data: { id: "invite-2", org_id: "org-3", role: "provider" },
      error: null,
    };
    mockSupabaseConfig.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000002",
          email: "creilly@example.com",
        },
      },
      error: null,
    });

    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=valid-code",
    );

    const response = await GET(request as never);

    expect(mockInviteEmailEq).toHaveBeenCalledWith("email", "creilly@example.com");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/sessions");
  });

  it("redirects to login with no_invite when no matching invite exists", async () => {
    mockAdminState.profileSelectResult = {
      data: null,
      error: { message: "not found" },
    };
    mockAdminState.inviteSelectResult = {
      data: null,
      error: { message: "not found" },
    };

    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=valid-code",
    );

    const response = await GET(request as never);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=no_invite",
    );
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("redirects to login with bootstrap_failed when profile creation fails", async () => {
    mockAdminState.profileSelectResult = {
      data: null,
      error: { message: "not found" },
    };
    mockAdminState.inviteSelectResult = {
      data: { id: "invite-3", org_id: "org-4", role: "provider" },
      error: null,
    };
    mockAdminState.profileInsertResult = {
      error: { message: "insert failed" },
    };

    const request = new Request(
      "http://localhost:3000/api/auth/callback?code=valid-code",
    );

    const response = await GET(request as never);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=bootstrap_failed",
    );
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("returns no_invite from POST when no matching invite exists", async () => {
    mockAdminState.profileSelectResult = {
      data: null,
      error: { message: "not found" },
    };
    mockAdminState.inviteSelectResult = {
      data: null,
      error: { message: "not found" },
    };
    mockSupabaseConfig.getUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000003",
          email: "nouser@example.com",
        },
      },
      error: null,
    });

    const request = new Request("http://localhost:3000/api/auth/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: "token",
      }),
    });

    const response = await POST(request as never);

    await expect(response.json()).resolves.toEqual({ error: "no_invite" });
    expect(response.status).toBe(403);
  });

  it("returns bootstrap_failed from POST when profile creation fails", async () => {
    mockAdminState.profileSelectResult = {
      data: null,
      error: { message: "not found" },
    };
    mockAdminState.inviteSelectResult = {
      data: { id: "invite-4", org_id: "org-5", role: "provider" },
      error: null,
    };
    mockAdminState.profileInsertResult = {
      error: { message: "insert failed" },
    };
    mockSupabaseConfig.getUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000004",
          email: "bootstrap@example.com",
        },
      },
      error: null,
    });

    const request = new Request("http://localhost:3000/api/auth/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: "token",
      }),
    });

    const response = await POST(request as never);

    await expect(response.json()).resolves.toEqual({ error: "bootstrap_failed" });
    expect(response.status).toBe(403);
  });

  it("returns the implicit auth bridge HTML when no code or token hash is provided", async () => {
    const request = new Request("http://localhost:3000/api/auth/callback");

    const response = await GET(request as never);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Signing you in");
    expect(body).toContain("access_token");
  });
});
