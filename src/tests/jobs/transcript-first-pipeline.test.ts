import { describe, expect, it, vi } from "vitest";

const {
  mockGetGlobalJobById,
  mockGenerateNote,
  mockUpsertNoteForJob,
  mockWriteAuditLog,
  mockMaybeSingle,
  mockIsDeleted,
  mockEqOrgId,
  mockEqSessionId,
  mockEqJobId,
  mockSelect,
  mockFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockGetGlobalJobById: vi.fn(),
  mockGenerateNote: vi.fn(),
  mockUpsertNoteForJob: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockIsDeleted: vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  })),
  mockEqOrgId: vi.fn(() => ({
    is: mockIsDeleted,
  })),
  mockEqSessionId: vi.fn(() => ({
    eq: mockEqOrgId,
  })),
  mockEqJobId: vi.fn(() => ({
    eq: mockEqSessionId,
  })),
  mockSelect: vi.fn(() => ({
    eq: mockEqJobId,
  })),
  mockFrom: vi.fn(() => ({
    select: mockSelect,
  })),
  mockCreateServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

vi.mock("../../lib/jobs/queries", () => ({
  getGlobalJobById: mockGetGlobalJobById,
}))

vi.mock("../../lib/ai/claude", () => ({
  generateNote: mockGenerateNote,
}))

vi.mock("../../lib/clinical/queries", () => ({
  upsertNoteForJob: mockUpsertNoteForJob,
}))

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}))

vi.mock("../../lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}))

import { generateNoteForJob } from "../../lib/jobs/processor";

describe("transcript-first note generation helper", () => {
  it("uses the saved transcript to generate an optional note later", async () => {
    mockGetGlobalJobById.mockResolvedValue({
      id: "job-99",
      session_id: "session-99",
      org_id: "org-99",
      created_by: "user-99",
      status: "complete",
      progress: 100,
      stage: "complete",
      note_type: "soap",
      attempt_count: 1,
      error_message: null,
      audio_storage_path: "org-99/session-99/job-99/recording.webm",
      transcript_storage_path: "org-99/session-99/job-99/transcript.txt",
      draft_storage_path: null,
      created_at: "2026-03-14T10:00:00.000Z",
      updated_at: "2026-03-14T10:00:00.000Z",
    });
    mockMaybeSingle.mockResolvedValue({
      data: { content: "Transcript for optional note generation." },
      error: null,
    });
    mockGenerateNote.mockResolvedValue({
      content: "Generated optional SOAP note",
      error: null,
    });
    mockUpsertNoteForJob.mockResolvedValue({
      data: { id: "note-99" },
      error: null,
    });
    mockWriteAuditLog.mockResolvedValue(undefined);

    const result = await generateNoteForJob("job-99");

    expect(result).toEqual({ success: true, error: null });
    expect(mockGenerateNote).toHaveBeenCalledWith({
      transcript: "Transcript for optional note generation.",
      noteType: "soap",
    });
    expect(mockUpsertNoteForJob).toHaveBeenCalledWith({
      sessionId: "session-99",
      orgId: "org-99",
      jobId: "job-99",
      createdBy: "user-99",
      noteType: "soap",
      content: "Generated optional SOAP note",
    });
  });

  it("writes the Anthropic vendor audit event when optional note generation runs", async () => {
    mockGetGlobalJobById.mockResolvedValue({
      id: "job-99",
      session_id: "session-99",
      org_id: "org-99",
      created_by: "user-99",
      status: "complete",
      progress: 100,
      stage: "complete",
      note_type: "soap",
      attempt_count: 1,
      error_message: null,
      audio_storage_path: "org-99/session-99/job-99/recording.webm",
      transcript_storage_path: "org-99/session-99/job-99/transcript.txt",
      draft_storage_path: null,
      created_at: "2026-03-14T10:00:00.000Z",
      updated_at: "2026-03-14T10:00:00.000Z",
    });
    mockMaybeSingle.mockResolvedValue({
      data: { content: "Transcript for optional note generation." },
      error: null,
    });
    mockGenerateNote.mockResolvedValue({
      content: "Generated optional SOAP note",
      error: null,
    });
    mockUpsertNoteForJob.mockResolvedValue({
      data: { id: "note-99" },
      error: null,
    });
    mockWriteAuditLog.mockResolvedValue(undefined);

    const result = await generateNoteForJob("job-99");

    expect(result).toEqual({ success: true, error: null });
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-99",
      actorId: "user-99",
      sessionId: "session-99",
      jobId: "job-99",
      action: "transcript.sent_to_vendor",
      vendor: "anthropic",
    });
  });
});
