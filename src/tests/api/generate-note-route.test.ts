import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetMySession,
  mockCheckRateLimit,
  mockAiClaudeTimeoutMs,
  mockAiRealApisEnabled,
  mockAiStubApisEnabled,
  mockAnthropicApiKey,
  mockCreateServiceClient,
  mockFetch,
} = vi.hoisted(() => {
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "consent-1" },
      error: null,
    }),
  };

  return {
    mockLoadCurrentUser: vi.fn(),
    mockGetMySession: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockAiClaudeTimeoutMs: vi.fn(() => 1000),
    mockAiRealApisEnabled: vi.fn(),
    mockAiStubApisEnabled: vi.fn(),
    mockAnthropicApiKey: vi.fn(),
    mockCreateServiceClient: vi.fn(() => ({
      from: vi.fn(() => builder),
    })),
    mockFetch: vi.fn(),
  };
});

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/sessions/queries", () => ({
  getMySession: mockGetMySession,
}));

vi.mock("@/lib/rate-limit", () => ({
  generateNoteLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...actual,
    aiClaudeTimeoutMs: mockAiClaudeTimeoutMs,
    aiRealApisEnabled: mockAiRealApisEnabled,
    aiStubApisEnabled: mockAiStubApisEnabled,
    anthropicApiKey: mockAnthropicApiKey,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { POST } from "@/app/api/generate-note/route";

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

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/generate-note", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-note", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMySession.mockResolvedValue({
      data: {
        id: "session-1",
        patient_label: "Patient A",
        session_type: "general",
      },
      error: null,
    });
    mockAiStubApisEnabled.mockReturnValue(false);
    mockAiRealApisEnabled.mockReturnValue(true);
    mockAnthropicApiKey.mockReturnValue("test-key");
    vi.stubGlobal("fetch", mockFetch);
  });

  it("returns 503 when real note generation is disabled", async () => {
    mockAiRealApisEnabled.mockReturnValue(false);

    const response = await POST(
      makeRequest({
        session_id: "session-1",
        transcript: "Client reports improved mood.",
        note_type: "SOAP",
        org_id: "org-1",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: "Note generation is unavailable" });
  });

  it("returns 503 when Anthropic is not configured", async () => {
    mockAnthropicApiKey.mockImplementation(() => {
      throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
    });

    const response = await POST(
      makeRequest({
        session_id: "session-1",
        transcript: "Client reports improved mood.",
        note_type: "SOAP",
        org_id: "org-1",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: "Anthropic note generation is not configured" });
  });
});
