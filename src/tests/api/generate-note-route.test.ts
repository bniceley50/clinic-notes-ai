import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetJobForOrg,
  mockGetMySession,
  mockGetLatestTranscriptForSession,
  mockGetTranscriptForJob,
  mockCheckRateLimit,
  mockAiClaudeTimeoutMs,
  mockAiRealApisEnabled,
  mockAiStubApisEnabled,
  mockAnthropicApiKey,
  mockCreateServiceClient,
  mockMaybeSingle,
  mockNoteSingle,
  mockFetch,
} = vi.hoisted(() => {
  return {
    mockLoadCurrentUser: vi.fn(),
    mockGetJobForOrg: vi.fn(),
    mockGetMySession: vi.fn(),
    mockGetLatestTranscriptForSession: vi.fn(),
    mockGetTranscriptForJob: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockAiClaudeTimeoutMs: vi.fn(() => 1000),
    mockAiRealApisEnabled: vi.fn(),
    mockAiStubApisEnabled: vi.fn(),
    mockAnthropicApiKey: vi.fn(),
    mockCreateServiceClient: vi.fn(),
    mockMaybeSingle: vi.fn(),
    mockNoteSingle: vi.fn(),
    mockFetch: vi.fn(),
  };
});

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/sessions/queries", () => ({
  getMySession: mockGetMySession,
}));

vi.mock("@/lib/jobs/queries", () => ({
  getJobForOrg: mockGetJobForOrg,
}));

vi.mock("@/lib/clinical/queries", () => ({
  getLatestTranscriptForSession: mockGetLatestTranscriptForSession,
  getTranscriptForJob: mockGetTranscriptForJob,
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
    mockGetJobForOrg.mockResolvedValue({ data: null, error: null });
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMySession.mockResolvedValue({
      data: {
        id: "session-1",
        patient_label: "Patient A",
        session_type: "general",
      },
      error: null,
    });
    mockGetLatestTranscriptForSession.mockResolvedValue({
      data: {
        id: "transcript-1",
        session_id: "session-1",
        org_id: "org-1",
        job_id: "job-1",
        content: "Server-stored transcript content.",
        duration_seconds: 42,
        word_count: 4,
        created_at: "2026-03-21T10:00:00.000Z",
      },
      error: null,
    });
    mockGetTranscriptForJob.mockResolvedValue({
      data: {
        id: "transcript-1",
        session_id: "session-1",
        org_id: "org-1",
        job_id: "job-1",
        content: "Server-stored transcript content.",
        duration_seconds: 42,
        word_count: 4,
        created_at: "2026-03-21T10:00:00.000Z",
      },
      error: null,
    });
    mockAiStubApisEnabled.mockReturnValue(false);
    mockAiRealApisEnabled.mockReturnValue(true);
    mockAnthropicApiKey.mockReturnValue("test-key");
    mockMaybeSingle.mockResolvedValue({
      data: { id: "consent-1" },
      error: null,
    });
    mockNoteSingle.mockResolvedValue({
      data: {
        id: "note-1",
        session_id: "session-1",
        org_id: "org-1",
        content: "Generated note content",
        note_type: "soap",
        created_at: "2026-03-21T10:05:00.000Z",
      },
      error: null,
    });
    mockCreateServiceClient.mockReturnValue({
      from: (table: string) => {
        if (table === "session_consents") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: mockMaybeSingle,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "notes") {
          return {
            insert: () => ({
              select: () => ({
                single: mockNoteSingle,
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  it("returns 503 when real note generation is disabled", async () => {
    mockAiRealApisEnabled.mockReturnValue(false);

    const response = await POST(
      makeRequest({
        session_id: "session-1",
        note_type: "SOAP",
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
        note_type: "SOAP",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: "Anthropic note generation is not configured" });
  });

  it("uses the stored transcript instead of client-supplied transcript text", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Generated note content" }],
      }),
    });

    const response = await POST(
      makeRequest({
        session_id: "session-1",
        transcript: "Client injected transcript should be ignored.",
        note_type: "SOAP",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.note_id).toBe("note-1");

    const fetchInit = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody = JSON.parse(String(fetchInit?.body));
    const prompt = requestBody.messages[0].content as string;

    expect(prompt).toContain("Server-stored transcript content.");
    expect(prompt).not.toContain("Client injected transcript should be ignored.");
  });

  it("returns 422 when no stored transcript exists", async () => {
    mockGetLatestTranscriptForSession.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await POST(
      makeRequest({
        session_id: "session-1",
        note_type: "SOAP",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toEqual({
      error: "Stored transcript is required before generating a note",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
