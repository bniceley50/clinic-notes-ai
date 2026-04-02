import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetGlobalJobById,
  mockClaimJobForProcessingGlobally,
  mockUpdateClaimedJobWorkerFieldsForOrg,
  mockDownloadAudioForJob,
  mockUploadTranscript,
  mockTranscribeAudioChunked,
  mockGenerateNote,
  mockUpsertTranscriptForJob,
  mockUpsertNoteForJob,
  mockWriteAuditLog,
  mockInsert,
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
  mockClaimJobForProcessingGlobally: vi.fn(),
  mockUpdateClaimedJobWorkerFieldsForOrg: vi.fn(),
  mockDownloadAudioForJob: vi.fn(),
  mockUploadTranscript: vi.fn(),
  mockTranscribeAudioChunked: vi.fn(),
  mockGenerateNote: vi.fn(),
  mockUpsertTranscriptForJob: vi.fn(),
  mockUpsertNoteForJob: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockInsert: vi.fn(),
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
  mockFrom: vi.fn((table?: string) => {
    if (table === "transcripts") {
      return { select: mockSelect };
    }
    return { insert: mockInsert };
  }),
  mockCreateServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("../../lib/jobs/queries", () => ({
  getGlobalJobById: mockGetGlobalJobById,
  claimJobForProcessingGlobally: mockClaimJobForProcessingGlobally,
  updateClaimedJobWorkerFieldsForOrg: mockUpdateClaimedJobWorkerFieldsForOrg,
}));

vi.mock("../../lib/storage/audio-download", () => ({
  downloadAudioForJob: mockDownloadAudioForJob,
}));

vi.mock("../../lib/storage/transcript", () => ({
  uploadTranscript: mockUploadTranscript,
}));

vi.mock("../../lib/ai/whisper", () => ({
  transcribeAudioChunked: mockTranscribeAudioChunked,
}));

vi.mock("../../lib/ai/claude", () => ({
  generateNote: mockGenerateNote,
}));

vi.mock("../../lib/clinical/queries", () => ({
  upsertTranscriptForJob: mockUpsertTranscriptForJob,
  upsertNoteForJob: mockUpsertNoteForJob,
}));

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("../../lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

import { generateNoteForJob, processJob } from "../../lib/jobs/processor";

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
  audio_storage_path: "org-1/session-1/job-1/recording.webm",
  transcript_storage_path: null,
  draft_storage_path: null,
  claimed_at: null,
  lease_expires_at: null,
  run_token: null,
  created_at: "2026-03-09T10:00:00.000Z",
  updated_at: "2026-03-09T10:00:00.000Z",
};

function makeClaimedJob(overrides: Partial<typeof baseJob> = {}) {
  return {
    ...baseJob,
    status: "running",
    progress: 10,
    stage: "transcribing",
    attempt_count: 1,
    claimed_at: "2026-03-22T00:00:00.000Z",
    lease_expires_at: "2026-03-22T00:05:00.000Z",
    run_token: "run-token-1",
    ...overrides,
  };
}

describe("job state machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockImplementation((table?: string) => {
      if (table === "transcripts") {
        return { select: mockSelect };
      }
      return { insert: mockInsert };
    });

    mockCreateServiceClient.mockReturnValue({
      from: mockFrom,
    });

    mockInsert.mockResolvedValue({ error: null });

    mockUploadTranscript.mockResolvedValue({
      storagePath: "org-1/session-1/job-1/transcript.txt",
      error: null,
    });

    mockUpsertTranscriptForJob.mockResolvedValue({
      data: { id: "transcript-1" },
      error: null,
    });

    mockUpsertNoteForJob.mockResolvedValue({
      data: { id: "note-1" },
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: { content: "Patient discussed treatment goals." },
      error: null,
    });

    mockDownloadAudioForJob.mockResolvedValue({
      data: Buffer.from("audio-bytes"),
      error: null,
    });

    mockTranscribeAudioChunked.mockImplementation(async (_data, _filename, onProgress) => {
      await onProgress(1, 2);
      return {
        text: "Patient discussed treatment goals.",
        error: null,
      };
    });

    mockGenerateNote.mockResolvedValue({
      content: "Generated SOAP note",
      error: null,
    });

    mockWriteAuditLog.mockResolvedValue(undefined);

    mockUpdateClaimedJobWorkerFieldsForOrg.mockResolvedValue({
      data: { id: "job-1" },
      error: null,
    });
  });

  it("a claimed job completes after transcription and threads run_token through fenced writes", async () => {
    mockClaimJobForProcessingGlobally.mockResolvedValue({
      data: makeClaimedJob(),
      error: null,
    });

    const result = await processJob("job-1");

    expect(result).toEqual({ success: true, error: null });
    expect(mockClaimJobForProcessingGlobally).toHaveBeenCalledWith("job-1", 300);
    expect(mockDownloadAudioForJob).toHaveBeenCalledWith(baseJob.audio_storage_path);
    expect(mockTranscribeAudioChunked).toHaveBeenCalledWith(
      Buffer.from("audio-bytes"),
      "recording.webm",
      expect.any(Function),
    );
    expect(mockUpsertTranscriptForJob).toHaveBeenCalledWith({
      sessionId: "session-1",
      orgId: "org-1",
      jobId: "job-1",
      content: "Patient discussed treatment goals.",
      durationSeconds: 0,
      wordCount: 4,
    });
    expect(mockGenerateNote).not.toHaveBeenCalled();
    expect(mockUpsertNoteForJob).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      sessionId: "session-1",
      jobId: "job-1",
      action: "audio.sent_to_vendor",
      vendor: "openai",
    });
    expect(mockUpdateClaimedJobWorkerFieldsForOrg).toHaveBeenNthCalledWith(
      1,
      "org-1",
      "job-1",
      "run-token-1",
      {
        stage: "transcribing",
        progress: 29,
      },
    );
    expect(mockUpdateClaimedJobWorkerFieldsForOrg).toHaveBeenLastCalledWith(
      "org-1",
      "job-1",
      "run-token-1",
      {
        status: "complete",
        stage: "complete",
        progress: 100,
        transcript_storage_path: "org-1/session-1/job-1/transcript.txt",
        claimed_at: null,
        lease_expires_at: null,
        run_token: null,
      },
    );
  });

  it("returns early when the job claim fails without side effects", async () => {
    mockClaimJobForProcessingGlobally.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await processJob("job-1");

    expect(result).toEqual({ success: true, error: null, alreadyRunning: true });
    expect(mockDownloadAudioForJob).not.toHaveBeenCalled();
    expect(mockTranscribeAudioChunked).not.toHaveBeenCalled();
    expect(mockUpdateClaimedJobWorkerFieldsForOrg).not.toHaveBeenCalled();
  });

  it("transient failures requeue the claimed job and clear lease metadata", async () => {
    mockClaimJobForProcessingGlobally.mockResolvedValue({
      data: makeClaimedJob({ attempt_count: 1 }),
      error: null,
    });
    mockDownloadAudioForJob.mockResolvedValue({
      data: null,
      error: "Failed to download audio",
    });

    const result = await processJob("job-1");

    expect(result).toEqual({ success: false, error: "Failed to download audio" });
    expect(mockUpdateClaimedJobWorkerFieldsForOrg).toHaveBeenCalledWith(
      "org-1",
      "job-1",
      "run-token-1",
      {
        status: "queued",
        stage: "queued",
        progress: 0,
        error_message: "Failed to download audio",
        claimed_at: null,
        lease_expires_at: null,
        run_token: null,
      },
    );
  });

  it("terminal failures mark the job failed and clear lease metadata", async () => {
    mockClaimJobForProcessingGlobally.mockResolvedValue({
      data: makeClaimedJob({ attempt_count: 3 }),
      error: null,
    });
    mockDownloadAudioForJob.mockResolvedValue({
      data: null,
      error: "Failed to download audio",
    });

    const result = await processJob("job-1");

    expect(result).toEqual({ success: false, error: "Failed to download audio" });
    expect(mockUpdateClaimedJobWorkerFieldsForOrg).toHaveBeenCalledWith(
      "org-1",
      "job-1",
      "run-token-1",
      {
        status: "failed",
        stage: "failed",
        error_message: "Failed to download audio",
        claimed_at: null,
        lease_expires_at: null,
        run_token: null,
      },
    );
  });

  it("returns claim lost when a stale run_token prevents a worker write", async () => {
    mockClaimJobForProcessingGlobally.mockResolvedValue({
      data: makeClaimedJob(),
      error: null,
    });
    mockUpdateClaimedJobWorkerFieldsForOrg.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await processJob("job-1");

    expect(result).toEqual({ success: false, error: "Job claim lost" });
    expect(mockUpdateClaimedJobWorkerFieldsForOrg).toHaveBeenCalledTimes(1);
  });

  it("generateNoteForJob remains callable independently after transcription", async () => {
    mockGetGlobalJobById.mockResolvedValue({
      ...baseJob,
      status: "complete",
      transcript_storage_path: "org-1/session-1/job-1/transcript.txt",
    });

    const result = await generateNoteForJob("job-1");

    expect(result).toEqual({ success: true, error: null });
    expect(mockSelect).toHaveBeenCalledWith("content");
    expect(mockGenerateNote).toHaveBeenCalledWith({
      transcript: "Patient discussed treatment goals.",
      noteType: "soap",
    });
    expect(mockUpsertNoteForJob).toHaveBeenCalledWith({
      sessionId: "session-1",
      orgId: "org-1",
      jobId: "job-1",
      createdBy: "user-1",
      noteType: "soap",
      content: "Generated SOAP note",
    });
  });
});
