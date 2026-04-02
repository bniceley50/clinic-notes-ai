import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cleanupState,
  mockAudioRemove,
  mockTranscriptRemove,
  mockDraftRemove,
  mockCreateServiceClient,
  mockJobTtlSeconds,
} = vi.hoisted(() => {
  const state = {
    cleanupRows: [] as Array<Record<string, unknown>>,
    cleanupError: null as { message: string } | null,
    purgeRows: [] as Array<Record<string, unknown>>,
    purgeError: null as { message: string } | null,
    sessionRows: [] as Array<Record<string, unknown>>,
    sessionError: null as { message: string } | null,
    jobsUpdateError: null as { message: string } | null,
    deleteErrors: {} as Record<string, { message: string } | null | undefined>,
    deleteCalls: [] as Array<{ table: string; column: string; values: string[] }>,
    lastJobsUpdate: null as {
      values: Record<string, unknown>;
      ids: string[];
    } | null,
    lastCleanupCutoff: null as string | null,
    lastPurgeSessionIds: [] as string[],
  };

  const mockAudioRemove = vi.fn(async () => ({ error: null }));
  const mockTranscriptRemove = vi.fn(async () => ({ error: null }));
  const mockDraftRemove = vi.fn(async () => ({ error: null }));

  const mockCreateServiceClient = vi.fn(() => ({
    from: (table: string) => {
      if (table === "jobs") {
        return {
          select: () => ({
            not: () => ({
              lte: (_column: string, cutoff: string) => ({
                or: async () => {
                  state.lastCleanupCutoff = cutoff;
                  return { data: state.cleanupRows, error: state.cleanupError };
                },
              }),
            }),
            in: (_column: string, values: string[]) => ({
              not: async () => {
                state.lastPurgeSessionIds = values;
                return { data: state.purgeRows, error: state.purgeError };
              },
            }),
          }),
          update: (values: Record<string, unknown>) => ({
            in: (_column: string, ids: string[]) => ({
              not: async () => {
                state.lastJobsUpdate = { values, ids };
                return { error: state.jobsUpdateError };
              },
            }),
          }),
          delete: () => ({
            in: (column: string, values: string[]) => ({
              not: async () => {
                state.deleteCalls.push({ table, column, values });
                return { error: state.deleteErrors.jobs ?? null };
              },
            }),
          }),
        };
      }

      if (table === "sessions") {
        return {
          select: () => ({
            not: async () => ({ data: state.sessionRows, error: state.sessionError }),
          }),
          delete: () => ({
            in: (column: string, values: string[]) => ({
              not: async () => {
                state.deleteCalls.push({ table, column, values });
                return { error: state.deleteErrors.sessions ?? null };
              },
            }),
          }),
        };
      }

      return {
        delete: () => ({
          in: (column: string, values: string[]) => ({
            not: async () => {
              state.deleteCalls.push({ table, column, values });
              return { error: state.deleteErrors[table] ?? null };
            },
          }),
        }),
      };
    },
    storage: {
      from: (bucket: string) => {
        if (bucket === "audio") {
          return { remove: mockAudioRemove };
        }

        if (bucket === "transcripts") {
          return { remove: mockTranscriptRemove };
        }

        if (bucket === "drafts") {
          return { remove: mockDraftRemove };
        }

        throw new Error(`Unexpected bucket: ${bucket}`);
      },
    },
  }));

  const mockJobTtlSeconds = vi.fn(() => 86_400);

  return {
    cleanupState: state,
    mockAudioRemove,
    mockTranscriptRemove,
    mockDraftRemove,
    mockCreateServiceClient,
    mockJobTtlSeconds,
  };
});

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("../../lib/config", () => ({
  jobTtlSeconds: mockJobTtlSeconds,
}));

import {
  cleanupSoftDeletedArtifactsGlobally,
  purgeTestSoftDeletedDataGlobally,
} from "../../lib/storage/cleanup";

describe("storage cleanup", () => {
  const originalAllowTestPurge = process.env.ALLOW_TEST_PURGE;

  beforeEach(() => {
    vi.clearAllMocks();
    cleanupState.cleanupRows = [];
    cleanupState.cleanupError = null;
    cleanupState.purgeRows = [];
    cleanupState.purgeError = null;
    cleanupState.sessionRows = [];
    cleanupState.sessionError = null;
    cleanupState.jobsUpdateError = null;
    cleanupState.deleteErrors = {};
    cleanupState.deleteCalls = [];
    cleanupState.lastJobsUpdate = null;
    cleanupState.lastCleanupCutoff = null;
    cleanupState.lastPurgeSessionIds = [];
    delete process.env.ALLOW_TEST_PURGE;
  });

  afterEach(() => {
    if (originalAllowTestPurge === undefined) {
      delete process.env.ALLOW_TEST_PURGE;
    } else {
      process.env.ALLOW_TEST_PURGE = originalAllowTestPurge;
    }
  });

  it("removes TTL-expired artifacts, normalizes legacy prefixes, and clears job paths", async () => {
    cleanupState.cleanupRows = [
      {
        id: "job-1",
        session_id: "session-1",
        org_id: "org-1",
        audio_storage_path: "audio/org-1/session-1/job-1/recording.webm",
        transcript_storage_path: "org-1/session-1/job-1/transcript.txt",
        draft_storage_path: "drafts/org-1/session-1/job-1/note.md",
      },
    ];

    const result = await cleanupSoftDeletedArtifactsGlobally();

    expect(result).toEqual({ cleaned: 1, error: null });
    expect(mockAudioRemove).toHaveBeenCalledWith([
      "org-1/session-1/job-1/recording.webm",
    ]);
    expect(mockTranscriptRemove).toHaveBeenCalledWith([
      "org-1/session-1/job-1/transcript.txt",
    ]);
    expect(mockDraftRemove).toHaveBeenCalledWith([
      "org-1/session-1/job-1/note.md",
    ]);
    expect(cleanupState.lastJobsUpdate).toMatchObject({
      ids: ["job-1"],
      values: {
        audio_storage_path: null,
        transcript_storage_path: null,
        draft_storage_path: null,
      },
    });
    expect(cleanupState.lastJobsUpdate?.values.updated_at).toEqual(expect.any(String));
    expect(cleanupState.lastCleanupCutoff).toEqual(expect.any(String));
  });

  it("skips cleanup when no TTL-expired artifact rows are returned", async () => {
    const result = await cleanupSoftDeletedArtifactsGlobally();

    expect(result).toEqual({ cleaned: 0, error: null });
    expect(mockAudioRemove).not.toHaveBeenCalled();
    expect(mockTranscriptRemove).not.toHaveBeenCalled();
    expect(mockDraftRemove).not.toHaveBeenCalled();
    expect(cleanupState.lastJobsUpdate).toBeNull();
  });

  it("throws when test purge is called without ALLOW_TEST_PURGE=1", async () => {
    await expect(purgeTestSoftDeletedDataGlobally()).rejects.toThrow(
      "purgeTestSoftDeletedDataGlobally() requires ALLOW_TEST_PURGE=1",
    );
  });

  it("purges soft-deleted test data when the explicit guard is enabled", async () => {
    process.env.ALLOW_TEST_PURGE = "1";
    cleanupState.sessionRows = [{ id: "session-1" }, { id: "session-2" }];
    cleanupState.purgeRows = [
      {
        id: "job-1",
        session_id: "session-1",
        org_id: "org-1",
        audio_storage_path: "audio/org-1/session-1/job-1/recording.webm",
        transcript_storage_path: "org-1/session-1/job-1/transcript.txt",
        draft_storage_path: null,
      },
    ];

    const result = await purgeTestSoftDeletedDataGlobally();

    expect(result).toEqual({ purged: 2, error: null });
    expect(cleanupState.lastPurgeSessionIds).toEqual(["session-1", "session-2"]);
    expect(mockAudioRemove).toHaveBeenCalledWith([
      "org-1/session-1/job-1/recording.webm",
    ]);
    expect(mockTranscriptRemove).toHaveBeenCalledWith([
      "org-1/session-1/job-1/transcript.txt",
    ]);
    expect(cleanupState.deleteCalls.map((call) => call.table)).toEqual([
      "notes",
      "transcripts",
      "carelogic_field_extractions",
      "jobs",
      "session_consents",
      "sessions",
    ]);
  });
});
