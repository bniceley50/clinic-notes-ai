import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockLoadCurrentUser,
  mockGetMyJob,
  mockGetMySession,
  mockGetTranscriptForJob,
  mockGetExtractionForTranscript,
  mockUpsertExtraction,
  mockCheckRateLimit,
  mockWriteAuditLog,
  mockEhrRegenerateLimit,
  mockAnthropicApiKey,
  mockAiRealApisEnabled,
  mockAiClaudeTimeoutMs,
  mockAnthropicModel,
  mockFetch,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMyJob: vi.fn(),
  mockGetMySession: vi.fn(),
  mockGetTranscriptForJob: vi.fn(),
  mockGetExtractionForTranscript: vi.fn(),
  mockUpsertExtraction: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockEhrRegenerateLimit: { name: "ehr-regenerate-limit" },
  mockAnthropicApiKey: vi.fn(),
  mockAiRealApisEnabled: vi.fn(),
  mockAiClaudeTimeoutMs: vi.fn(() => 1000),
  mockAnthropicModel: vi.fn(() => "claude-sonnet-4-20250514"),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/jobs/queries", () => ({
  getMyJob: mockGetMyJob,
}));

vi.mock("@/lib/sessions/queries", () => ({
  getMySession: mockGetMySession,
}));

vi.mock("@/lib/clinical/queries", () => ({
  getTranscriptForJob: mockGetTranscriptForJob,
  getExtractionForTranscript: mockGetExtractionForTranscript,
  upsertExtraction: mockUpsertExtraction,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
  ehrRegenerateLimit: mockEhrRegenerateLimit,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...actual,
    anthropicApiKey: mockAnthropicApiKey,
    aiRealApisEnabled: mockAiRealApisEnabled,
    aiClaudeTimeoutMs: mockAiClaudeTimeoutMs,
    anthropicModel: mockAnthropicModel,
  };
});

vi.mock("@/lib/logger", () => ({
  withLogging: <T>(handler: T) => handler,
}));

import { GET } from "@/app/api/jobs/[id]/carelogic-fields/route";

const authenticatedResult = {
  status: "authenticated" as const,
  user: {
    userId: "00000000-0000-0000-0000-000000000001",
    orgId: "00000000-0000-0000-0000-000000000010",
    role: "provider",
    email: "clinician@example.com",
    profile: {
      id: "profile-1",
      user_id: "00000000-0000-0000-0000-000000000001",
      org_id: "00000000-0000-0000-0000-000000000010",
      display_name: "Jane Doe",
      role: "provider",
      created_at: "2026-03-13T12:00:00.000Z",
    },
    org: {
      id: "00000000-0000-0000-0000-000000000010",
      name: "Test Org",
      created_at: "2026-03-13T12:00:00.000Z",
    },
  },
};

const ownedJob = {
  id: "job-1",
  session_id: "session-1",
  org_id: "00000000-0000-0000-0000-000000000010",
  created_by: "00000000-0000-0000-0000-000000000001",
  note_type: "soap",
  status: "complete",
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/jobs/job-1/carelogic-fields", {
    method: "GET",
    headers: {
      "x-vercel-id": "test-request-id",
    },
  });
}

function makeRegenerateRequest(): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/jobs/job-1/carelogic-fields?regenerate=true",
    {
      method: "GET",
      headers: {
        "x-vercel-id": "test-request-id",
      },
    },
  );
}

describe("GET /api/jobs/[id]/carelogic-fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMyJob.mockResolvedValue({ data: ownedJob, error: null });
    mockGetMySession.mockResolvedValue({
      data: { id: "session-1", session_type: "general" },
      error: null,
    });
    mockGetTranscriptForJob.mockResolvedValue({
      data: { id: "tx-1", content: "Client reports improved mood." },
      error: null,
    });
    mockGetExtractionForTranscript.mockResolvedValue({
      data: null,
      error: null,
    });
    mockUpsertExtraction.mockResolvedValue({
      data: {
        id: "extract-1",
        session_id: "session-1",
        org_id: authenticatedResult.user.orgId,
        job_id: "job-1",
        transcript_id: "tx-1",
        session_type: "general",
        fields: {
          client_perspective: "Client reported improved mood and reduced anxiety.",
          current_status_interventions: "Clinician reviewed coping strategies.",
          response_to_interventions: "Client was receptive and agreed to continue practice.",
          since_last_visit: "No major changes reported.",
          goals_addressed: "Anxiety reduction.",
          interactive_complexity: "[Insufficient information in transcript]",
          coordination_of_care: "[Insufficient information in transcript]",
          mse_summary: "Client appeared calm, cooperative, and future oriented.",
        },
        generated_by: authenticatedResult.user.userId,
        generated_at: "2026-03-22T00:00:00.000Z",
        updated_at: "2026-03-22T00:00:00.000Z",
      },
      error: null,
    });
    mockAnthropicApiKey.mockReturnValue("test-anthropic-key");
    mockAiRealApisEnabled.mockReturnValue(true);
    mockWriteAuditLog.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: "```json\n{\"client_perspective\":\"Client reported improved mood and reduced anxiety.\",\"current_status_interventions\":\"Clinician reviewed coping strategies.\",\"response_to_interventions\":\"Client was receptive and agreed to continue practice.\",\"since_last_visit\":\"No major changes reported.\",\"goals_addressed\":\"Anxiety reduction.\",\"interactive_complexity\":\"[Insufficient information in transcript]\",\"coordination_of_care\":\"[Insufficient information in transcript]\",\"mse_summary\":\"Client appeared calm, cooperative, and future oriented.\"}\n```",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an existing stored extraction without calling Anthropic", async () => {
    mockGetExtractionForTranscript.mockResolvedValue({
      data: {
        id: "extract-1",
        session_id: "session-1",
        org_id: authenticatedResult.user.orgId,
        job_id: "job-1",
        transcript_id: "tx-1",
        session_type: "general",
        fields: {
          client_perspective: "Stored client perspective",
        },
        generated_by: authenticatedResult.user.userId,
        generated_at: "2026-03-22T00:00:00.000Z",
        updated_at: "2026-03-22T00:00:00.000Z",
      },
      error: null,
    });

    const response = await GET(
      makeRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      fields: {
        client_perspective: "Stored client perspective",
      },
      generated_at: "2026-03-22T00:00:00.000Z",
      sessionType: "general",
    });
    expect(mockGetTranscriptForJob).toHaveBeenCalledWith(
      authenticatedResult.user,
      "session-1",
      "job-1",
    );
    expect(mockGetExtractionForTranscript).toHaveBeenCalledWith(
      authenticatedResult.user,
      "tx-1",
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockUpsertExtraction).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("calls Anthropic and stores the extracted fields when no stored extraction exists", async () => {
    const response = await GET(
      makeRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      fields: {
        client_perspective: "Client reported improved mood and reduced anxiety.",
        current_status_interventions: "Clinician reviewed coping strategies.",
        response_to_interventions: "Client was receptive and agreed to continue practice.",
        since_last_visit: "No major changes reported.",
        goals_addressed: "Anxiety reduction.",
        interactive_complexity: "[Insufficient information in transcript]",
        coordination_of_care: "[Insufficient information in transcript]",
        mse_summary: "Client appeared calm, cooperative, and future oriented.",
      },
      generated_at: "2026-03-22T00:00:00.000Z",
      sessionType: "general",
    });
    expect(mockGetMyJob).toHaveBeenCalledWith(authenticatedResult.user, "job-1");
    expect(mockGetTranscriptForJob).toHaveBeenCalledWith(
      authenticatedResult.user,
      "session-1",
      "job-1",
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockUpsertExtraction).toHaveBeenCalledWith(authenticatedResult.user, {
      fields: {
        client_perspective: "Client reported improved mood and reduced anxiety.",
        current_status_interventions: "Clinician reviewed coping strategies.",
        response_to_interventions: "Client was receptive and agreed to continue practice.",
        since_last_visit: "No major changes reported.",
        goals_addressed: "Anxiety reduction.",
        interactive_complexity: "[Insufficient information in transcript]",
        coordination_of_care: "[Insufficient information in transcript]",
        mse_summary: "Client appeared calm, cooperative, and future oriented.",
      },
      jobId: "job-1",
      sessionId: "session-1",
      sessionType: "general",
      transcriptId: "tx-1",
    });
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: authenticatedResult.user.orgId,
      actorId: authenticatedResult.user.userId,
      sessionId: "session-1",
      jobId: "job-1",
      action: "carelogic_fields_generated",
      vendor: "anthropic",
      requestId: "test-request-id",
      metadata: {
        session_type: "general",
      },
    });
  });

  it("regenerate=true ignores stored extraction, calls Anthropic, and overwrites the stored result", async () => {
    mockGetExtractionForTranscript.mockResolvedValue({
      data: {
        id: "extract-1",
        session_id: "session-1",
        org_id: authenticatedResult.user.orgId,
        job_id: "job-1",
        transcript_id: "tx-1",
        session_type: "general",
        fields: {
          client_perspective: "Old stored value",
        },
        generated_by: authenticatedResult.user.userId,
        generated_at: "2026-03-22T00:00:00.000Z",
        updated_at: "2026-03-22T00:00:00.000Z",
      },
      error: null,
    });
    mockUpsertExtraction.mockResolvedValue({
      data: {
        id: "extract-1",
        session_id: "session-1",
        org_id: authenticatedResult.user.orgId,
        job_id: "job-1",
        transcript_id: "tx-1",
        session_type: "general",
        fields: {
          client_perspective: "Regenerated value",
        },
        generated_by: authenticatedResult.user.userId,
        generated_at: "2026-03-22T01:00:00.000Z",
        updated_at: "2026-03-22T01:00:00.000Z",
      },
      error: null,
    });

    const response = await GET(
      makeRegenerateRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      fields: {
        client_perspective: "Regenerated value",
      },
      generated_at: "2026-03-22T01:00:00.000Z",
      sessionType: "general",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockUpsertExtraction).toHaveBeenCalledTimes(1);
  });

  it("writes a distinct regeneration audit event when regenerate=true", async () => {
    const response = await GET(
      makeRegenerateRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: authenticatedResult.user.orgId,
      actorId: authenticatedResult.user.userId,
      sessionId: "session-1",
      jobId: "job-1",
      action: "carelogic_fields_regenerated",
      vendor: "anthropic",
      requestId: "test-request-id",
      metadata: {
        session_type: "general",
      },
    });
  });

  it("returns 429 on regenerate when the dedicated EHR limiter fires", async () => {
    const limitedResponse = new Response(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
    mockCheckRateLimit
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(limitedResponse);

    const response = await GET(
      makeRegenerateRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toEqual({ error: "Too many requests" });
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(1, null, "user:user-1");
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
      2,
      mockEhrRegenerateLimit,
      "user:user-1",
    );
    expect(mockGetMyJob).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockLoadCurrentUser.mockResolvedValue({ status: "no_session" });

    const response = await GET(
      makeRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Unauthorized" });
    expect(mockGetMyJob).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 404 for non-owners without leaking transcript details", async () => {
    mockGetMyJob.mockResolvedValue({ data: null, error: "not found" });

    const response = await GET(
      makeRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Job not found" });
    expect(JSON.stringify(payload)).not.toContain("Client reports improved mood.");
    expect(mockGetTranscriptForJob).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 503 when Anthropic is not configured", async () => {
    mockAnthropicApiKey.mockImplementation(() => {
      throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
    });

    const response = await GET(
      makeRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      error: "Anthropic EHR field extraction is not configured",
    });
  });

  it("returns 502 when Claude returns invalid JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: "not-json",
          },
        ],
      }),
    });

    const response = await GET(
      makeRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      error: "Anthropic returned invalid JSON for EHR fields",
    });
  });

  it('returns 500 when upsertExtraction fails with "Failed to store EHR fields"', async () => {
    mockUpsertExtraction.mockResolvedValue({
      data: null,
      error: "insert failed",
    });

    const response = await GET(
      makeRequest() as never,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "Failed to store EHR fields",
    });
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});
