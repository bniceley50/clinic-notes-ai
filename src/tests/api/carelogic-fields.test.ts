import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetMyJob,
  mockGetMySession,
  mockGetLatestTranscriptForSession,
  mockCheckRateLimit,
  mockWriteAuditLog,
  mockAnthropicApiKey,
  mockAiRealApisEnabled,
  mockFetch,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMyJob: vi.fn(),
  mockGetMySession: vi.fn(),
  mockGetLatestTranscriptForSession: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockAnthropicApiKey: vi.fn(),
  mockAiRealApisEnabled: vi.fn(),
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
  getLatestTranscriptForSession: mockGetLatestTranscriptForSession,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
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

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/jobs/job-1/carelogic-fields", {
    method: "GET",
    headers: {
      "x-vercel-id": "test-request-id",
    },
  });
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
    mockGetLatestTranscriptForSession.mockResolvedValue({
      data: { id: "tx-1", content: "Client reports improved mood." },
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

  it("returns extracted fields for the authenticated job owner", async () => {
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
      sessionType: "general",
    });
    expect(mockGetMyJob).toHaveBeenCalledWith(authenticatedResult.user, "job-1");
    expect(mockFetch).toHaveBeenCalledTimes(1);
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
    expect(mockGetLatestTranscriptForSession).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
