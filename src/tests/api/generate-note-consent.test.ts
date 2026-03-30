import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetLatestTranscriptForSession,
  mockGetTranscriptForJob,
  mockGetJobForOrg,
  mockGetMySession,
  mockCheckRateLimit,
  mockAiStubApisEnabled,
  mockAiRealApisEnabled,
  mockBuildStubNote,
  mockCreateServiceClient,
  mockWriteAuditLog,
  mockMaybeSingle,
  mockConsentLimit,
  mockConsentIsDeleted,
  mockConsentEqOrg,
  mockConsentEqSession,
  mockConsentSelect,
  mockNoteSingle,
  mockNoteSelect,
  mockNoteInsert,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetLatestTranscriptForSession: vi.fn(),
  mockGetTranscriptForJob: vi.fn(),
  mockGetJobForOrg: vi.fn(),
  mockGetMySession: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockAiStubApisEnabled: vi.fn(),
  mockAiRealApisEnabled: vi.fn(),
  mockBuildStubNote: vi.fn(),
  mockCreateServiceClient: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockConsentLimit: vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  })),
  mockConsentIsDeleted: vi.fn(() => ({
    limit: mockConsentLimit,
  })),
  mockConsentEqOrg: vi.fn(() => ({
    is: mockConsentIsDeleted,
  })),
  mockConsentEqSession: vi.fn(() => ({
    eq: mockConsentEqOrg,
  })),
  mockConsentSelect: vi.fn(() => ({
    eq: mockConsentEqSession,
  })),
  mockNoteSingle: vi.fn(),
  mockNoteSelect: vi.fn(() => ({
    single: mockNoteSingle,
  })),
  mockNoteInsert: vi.fn(() => ({
    select: mockNoteSelect,
  })),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/jobs/queries", () => ({
  getJobForOrg: mockGetJobForOrg,
}));

vi.mock("@/lib/clinical/queries", () => ({
  getLatestTranscriptForSession: mockGetLatestTranscriptForSession,
  getTranscriptForJob: mockGetTranscriptForJob,
}));

vi.mock("@/lib/sessions/queries", () => ({
  getMySession: mockGetMySession,
}));

vi.mock("@/lib/jobs/stubs", () => ({
  buildStubNote: mockBuildStubNote,
}));

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...actual,
    aiStubApisEnabled: mockAiStubApisEnabled,
    aiRealApisEnabled: mockAiRealApisEnabled,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("@/lib/rate-limit", () => ({
  generateNoteLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: <T>(handler: T) => handler,
}));

import { POST } from "@/app/api/generate-note/route";

const authenticatedResult = {
  status: "authenticated" as const,
  user: {
    userId: "user-1",
    orgId: "org-1",
    role: "provider",
    email: "user@example.com",
    profile: {
      id: "profile-1",
      user_id: "user-1",
      org_id: "org-1",
      display_name: "User One",
      role: "provider",
      created_at: "2026-03-09T10:00:00.000Z",
    },
    org: {
      id: "org-1",
      name: "Org One",
      created_at: "2026-03-09T10:00:00.000Z",
    },
  },
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/generate-note", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-note consent enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockGetJobForOrg.mockResolvedValue({
      data: null,
      error: null,
    });
    mockGetLatestTranscriptForSession.mockResolvedValue({
      data: {
        id: "transcript-1",
        session_id: "session-1",
        org_id: "org-1",
        job_id: "job-1",
        content: "Stored transcript content.",
        duration_seconds: 245,
        word_count: 3,
        created_at: "2026-03-17T12:00:00.000Z",
      },
      error: null,
    });
    mockGetTranscriptForJob.mockResolvedValue({
      data: {
        id: "transcript-1",
        session_id: "session-1",
        org_id: "org-1",
        job_id: "11111111-1111-4111-8111-111111111111",
        content: "Stored transcript content.",
        duration_seconds: 245,
        word_count: 3,
        created_at: "2026-03-17T12:00:00.000Z",
      },
      error: null,
    });
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMySession.mockResolvedValue({
      data: {
        id: "session-1",
        patient_label: "Patient A",
        session_type: "therapy",
      },
      error: null,
    });
    mockAiStubApisEnabled.mockReturnValue(true);
    mockAiRealApisEnabled.mockReturnValue(false);
    mockBuildStubNote.mockReturnValue("Stub note content");
    mockMaybeSingle.mockResolvedValue({
      data: { id: "consent-1" },
      error: null,
    });
    mockNoteSingle.mockResolvedValue({
      data: {
        id: "note-1",
        session_id: "session-1",
        org_id: "org-1",
        content: "Stub note content",
        note_type: "soap",
        created_at: "2026-03-17T12:00:00.000Z",
      },
      error: null,
    });
    mockCreateServiceClient.mockReturnValue({
      from: (table: string) => {
        if (table === "session_consents") {
          return {
            select: mockConsentSelect,
          };
        }

        if (table === "notes") {
          return {
            insert: mockNoteInsert,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });
  });

  it("returns 403 when consent is missing", async () => {
    mockMaybeSingle.mockResolvedValue({
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

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      error: "Patient consent must be recorded before generating a note",
    });
    expect(mockBuildStubNote).not.toHaveBeenCalled();
    expect(mockNoteInsert).not.toHaveBeenCalled();
  });

  it("returns 500 when consent lookup fails", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "db failed" },
    });

    const response = await POST(
      makeRequest({
        session_id: "session-1",
        note_type: "SOAP",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "Failed to verify patient consent",
    });
    expect(mockBuildStubNote).not.toHaveBeenCalled();
    expect(mockNoteInsert).not.toHaveBeenCalled();
  });

  it("proceeds to note creation when consent exists", async () => {
    const response = await POST(
      makeRequest({
        session_id: "session-1",
        note_type: "SOAP",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      note_id: "note-1",
      session_id: "session-1",
      note_type: "SOAP",
      content: "Stub note content",
      created_at: "2026-03-17T12:00:00.000Z",
      stub_mode: true,
    });
    expect(mockConsentEqSession).toHaveBeenCalledWith("session_id", "session-1");
    expect(mockConsentEqOrg).toHaveBeenCalledWith("org_id", "org-1");
    expect(mockBuildStubNote).toHaveBeenCalledWith("soap", {
      patientLabel: "Patient A",
      providerName: "User One",
      sessionType: "therapy",
    });
    expect(mockGetLatestTranscriptForSession).toHaveBeenCalledWith(
      authenticatedResult.user,
      "session-1",
    );
    expect(mockGetJobForOrg).not.toHaveBeenCalled();
    expect(mockNoteInsert).toHaveBeenCalledWith({
      session_id: "session-1",
      org_id: "org-1",
      job_id: null,
      content: "Stub note content",
      note_type: "soap",
      status: "draft",
      created_by: "user-1",
    });
  });

  it("inserts note with job_id when a valid jobId is provided", async () => {
    mockGetJobForOrg.mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        session_id: "session-1",
        org_id: "org-1",
        created_by: "user-2",
        status: "complete",
        progress: 100,
        stage: "complete",
        note_type: "soap",
        attempt_count: 1,
        error_message: null,
        audio_storage_path: null,
        transcript_storage_path: null,
        draft_storage_path: null,
        created_at: "2026-03-17T12:00:00.000Z",
        updated_at: "2026-03-17T12:05:00.000Z",
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        session_id: "session-1",
        note_type: "SOAP",
        jobId: "11111111-1111-4111-8111-111111111111",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.note_id).toBe("note-1");
    expect(mockGetJobForOrg).toHaveBeenCalledWith(
      authenticatedResult.user,
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockGetTranscriptForJob).toHaveBeenCalledWith(
      authenticatedResult.user,
      "session-1",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockNoteInsert).toHaveBeenCalledWith({
      session_id: "session-1",
      org_id: "org-1",
      job_id: "11111111-1111-4111-8111-111111111111",
      content: "Stub note content",
      note_type: "soap",
      status: "draft",
      created_by: "user-1",
    });
  });

  it("returns 400 when jobId is provided but job is not found", async () => {
    mockGetJobForOrg.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await POST(
      makeRequest({
        session_id: "session-1",
        note_type: "SOAP",
        jobId: "11111111-1111-4111-8111-111111111111",
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Invalid jobId" });
    expect(mockNoteInsert).not.toHaveBeenCalled();
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
    expect(mockBuildStubNote).not.toHaveBeenCalled();
    expect(mockNoteInsert).not.toHaveBeenCalled();
  });
});
