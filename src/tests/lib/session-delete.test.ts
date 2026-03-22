import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  callOrder,
  mockStorageRemoveAudio,
  mockStorageRemoveTranscripts,
  mockStorageRemoveDrafts,
  mockCreateServiceClient,
} = vi.hoisted(() => {
  const order: string[] = [];

  const jobs = [
    {
      id: "job-1",
      audio_storage_path: "org-1/session-1/job-1/recording.webm",
      transcript_storage_path: "org-1/session-1/job-1/transcript.txt",
      draft_storage_path: "drafts/org-1/session-1/job-1/note.md",
    },
  ];

  const mockJobsFinalEq = vi.fn(async () => {
    order.push("jobs.load");
    return { data: jobs, error: null };
  });
  const mockNotesFinalEq = vi.fn(async () => {
    order.push("notes.delete");
    return { error: null };
  });
  const mockTranscriptsFinalEq = vi.fn(async () => {
    order.push("transcripts.delete");
    return { error: null };
  });
  const mockJobsDeleteFinalEq = vi.fn(async () => {
    order.push("jobs.delete");
    return { error: null };
  });
  const mockConsentsFinalEq = vi.fn(async () => {
    order.push("consents.delete");
    return { error: null };
  });
  const mockExtractionsFinalEq = vi.fn(async () => {
    order.push("extractions.delete");
    return { error: null };
  });
  const mockSessionsFinalEq = vi.fn(async () => {
    order.push("session.delete");
    return { error: null };
  });

  const mockStorageRemoveAudio = vi.fn(async () => {
    order.push("audio.storage.delete");
    return { error: null };
  });
  const mockStorageRemoveTranscripts = vi.fn(async () => {
    order.push("transcripts.storage.delete");
    return { error: null };
  });
  const mockStorageRemoveDrafts = vi.fn(async () => {
    order.push("drafts.storage.delete");
    return { error: null };
  });

  const mockCreateServiceClient = vi.fn(() => ({
    from: (table: string) => {
      switch (table) {
        case "jobs":
          return {
            select: () => ({
              eq: () => ({
                eq: mockJobsFinalEq,
              }),
            }),
            delete: () => ({
              eq: () => ({
                eq: mockJobsDeleteFinalEq,
              }),
            }),
          };
        case "notes":
          return {
            delete: () => ({
              eq: () => ({
                eq: mockNotesFinalEq,
              }),
            }),
          };
        case "transcripts":
          return {
            delete: () => ({
              eq: () => ({
                eq: mockTranscriptsFinalEq,
              }),
            }),
          };
        case "session_consents":
          return {
            delete: () => ({
              eq: () => ({
                eq: mockConsentsFinalEq,
              }),
            }),
          };
        case "carelogic_field_extractions":
          return {
            delete: () => ({
              eq: () => ({
                eq: mockExtractionsFinalEq,
              }),
            }),
          };
        case "sessions":
          return {
            delete: () => ({
              eq: () => ({
                eq: mockSessionsFinalEq,
              }),
            }),
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
    storage: {
      from: (bucket: string) => {
        switch (bucket) {
          case "audio":
            return { remove: mockStorageRemoveAudio };
          case "transcripts":
            return { remove: mockStorageRemoveTranscripts };
          case "drafts":
            return { remove: mockStorageRemoveDrafts };
          default:
            throw new Error(`Unexpected bucket ${bucket}`);
        }
      },
    },
  }));

  return {
    callOrder: order,
    mockStorageRemoveAudio,
    mockStorageRemoveTranscripts,
    mockStorageRemoveDrafts,
    mockJobsFinalEq,
    mockNotesFinalEq,
    mockTranscriptsFinalEq,
    mockJobsDeleteFinalEq,
    mockConsentsFinalEq,
    mockExtractionsFinalEq,
    mockSessionsFinalEq,
    mockCreateServiceClient,
  };
});

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { deleteSessionCascade } from "../../lib/sessions/queries";

describe("deleteSessionCascade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
  });

  it("deletes rows and storage artifacts in the required order", async () => {
    const result = await deleteSessionCascade("session-1", "org-1");

    expect(result).toEqual({ deleted: true });
    expect(callOrder).toEqual([
      "jobs.load",
      "notes.delete",
      "transcripts.delete",
      "audio.storage.delete",
      "transcripts.storage.delete",
      "drafts.storage.delete",
      "extractions.delete",
      "jobs.delete",
      "consents.delete",
      "session.delete",
    ]);
    expect(mockStorageRemoveAudio).toHaveBeenCalledWith([
      "org-1/session-1/job-1/recording.webm",
    ]);
    expect(mockStorageRemoveTranscripts).toHaveBeenCalledWith([
      "org-1/session-1/job-1/transcript.txt",
    ]);
    expect(mockStorageRemoveDrafts).toHaveBeenCalledWith([
      "drafts/org-1/session-1/job-1/note.md",
    ]);
  });
});
