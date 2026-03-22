import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetJobById,
  mockUpdateJobWorkerFields,
  mockBuildStubTranscript,
  mockEnsureTranscriptsBucket,
  mockWriteAuditLog,
  mockUpsertTranscriptForJob,
  mockStorageUpload,
  mockSessionSingle,
  mockProfileSingle,
} = vi.hoisted(() => ({
  mockGetJobById: vi.fn(),
  mockUpdateJobWorkerFields: vi.fn(),
  mockBuildStubTranscript: vi.fn(),
  mockEnsureTranscriptsBucket: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockUpsertTranscriptForJob: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockSessionSingle: vi.fn(),
  mockProfileSingle: vi.fn(),
}));

vi.mock("../../lib/jobs/queries", () => ({
  getJobById: mockGetJobById,
  updateJobWorkerFields: mockUpdateJobWorkerFields,
}));

vi.mock("../../lib/jobs/storage", () => ({
  TRANSCRIPTS_BUCKET: "transcripts",
  DRAFTS_BUCKET: "drafts",
  ensureTranscriptsBucket: mockEnsureTranscriptsBucket,
  ensureDraftsBucket: vi.fn(),
  buildTranscriptStoragePath: vi.fn(
    () => "transcripts/org-1/session-1/job-1/transcript.txt",
  ),
  buildDraftStoragePath: vi.fn(() => "drafts/org-1/session-1/job-1/note.md"),
}));

vi.mock("../../lib/jobs/stubs", () => ({
  buildStubTranscript: mockBuildStubTranscript,
  buildStubNote: vi.fn(),
}));

vi.mock("../../lib/clinical/queries", () => ({
  upsertTranscriptForJob: mockUpsertTranscriptForJob,
  upsertNoteForJob: vi.fn(),
}));

vi.mock("../../lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "sessions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: mockSessionSingle,
              }),
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: mockProfileSingle,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from: () => ({
        upload: mockStorageUpload,
      }),
    },
  })),
}));

import { runStubPipeline } from "../../lib/jobs/pipeline";

const baseJob = {
  id: "job-1",
  session_id: "session-1",
  org_id: "org-1",
  created_by: "user-1",
  status: "queued",
  progress: 0,
  stage: "queued",
  note_type: "soap",
  attempt_count: 0,
  error_message: null,
  audio_storage_path: "audio/org-1/session-1/job-1/recording.webm",
  transcript_storage_path: null,
  draft_storage_path: null,
  created_at: "2026-03-09T10:00:00.000Z",
  updated_at: "2026-03-09T10:00:00.000Z",
};

describe("stub transcript-only pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetJobById
      .mockResolvedValueOnce(baseJob)
      .mockResolvedValueOnce({
        ...baseJob,
        status: "running",
        attempt_count: 1,
      });
    mockUpdateJobWorkerFields
      .mockResolvedValueOnce({ data: { id: "job-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "job-1" }, error: null });
    mockSessionSingle.mockResolvedValue({
      data: {
        patient_label: "Patient A",
        session_type: "therapy",
      },
      error: null,
    });
    mockProfileSingle.mockResolvedValue({
      data: {
        display_name: "User One",
      },
      error: null,
    });
    mockEnsureTranscriptsBucket.mockResolvedValue({ error: null });
    mockBuildStubTranscript.mockReturnValue(
      "Provider: Stub transcript content for testing.",
    );
    mockStorageUpload.mockResolvedValue({ error: null });
    mockUpsertTranscriptForJob.mockResolvedValue({
      data: { id: "transcript-1" },
      error: null,
    });
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("does not emit an Anthropic vendor audit event on transcript-only runs", async () => {
    const runPromise = runStubPipeline("job-1");
    await vi.runAllTimersAsync();
    const result = await runPromise;

    expect(result).toEqual({ jobId: "job-1", status: "completed" });
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      sessionId: "session-1",
      jobId: "job-1",
      action: "audio.sent_to_vendor",
      vendor: "openai",
      metadata: { stub: true },
    });
    expect(mockWriteAuditLog).not.toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      sessionId: "session-1",
      jobId: "job-1",
      action: "transcript.sent_to_vendor",
      vendor: "anthropic",
      metadata: { stub: true },
    });
  });
});
