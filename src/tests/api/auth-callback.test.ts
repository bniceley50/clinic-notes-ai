import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateClient,
  mockCreateServiceClient,
  mockCreateSessionCookie,
  mockSupabaseConfig,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateServiceClient: vi.fn(),
  mockCreateSessionCookie: vi.fn(),
  mockSupabaseConfig: {
    exchangeCodeForSession: vi.fn(),
    verifyOtp: vi.fn(),
    getUser: vi.fn(),
  },
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

import { GET } from "../../app/api/auth/callback/route";

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
                  data: { org_id: "org-1", role: "provider" },
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

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