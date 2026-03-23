import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockStorageInfo,
  mockStorageDownload,
  mockStorageRemove,
  mockStorageFrom,
  mockUpdateEq,
  mockJobsUpdate,
  mockDbFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockStorageInfo: vi.fn(),
  mockStorageDownload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockStorageFrom: vi.fn(() => ({
    info: mockStorageInfo,
    download: mockStorageDownload,
    remove: mockStorageRemove,
  })),
  mockUpdateEq: vi.fn(),
  mockJobsUpdate: vi.fn(() => ({
    eq: mockUpdateEq,
  })),
  mockDbFrom: vi.fn(() => ({
    update: mockJobsUpdate,
  })),
  mockCreateServiceClient: vi.fn(() => ({
    storage: {
      from: mockStorageFrom,
    },
    from: mockDbFrom,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { finalizeAudioUploadForJob } from "@/lib/storage/audio";

describe("finalizeAudioUploadForJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageInfo.mockResolvedValue({
      data: { name: "recording.webm" },
      error: null,
    });
    mockStorageDownload.mockResolvedValue({
      data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])]),
      error: null,
    });
    mockStorageRemove.mockResolvedValue({ data: [], error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it("deletes the uploaded object when download verification fails", async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: { message: "download failed" },
    });

    const result = await finalizeAudioUploadForJob({
      jobId: "job-1",
      storagePath: "org-1/session-1/job-1/recording.webm",
    });

    expect(result).toEqual({
      storagePath: null,
      error: "download failed",
    });
    expect(mockStorageRemove).toHaveBeenCalledWith([
      "org-1/session-1/job-1/recording.webm",
    ]);
    expect(mockDbFrom).not.toHaveBeenCalled();
  });

  it("deletes the uploaded object when the signature is invalid", async () => {
    mockStorageDownload.mockResolvedValue({
      data: new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03])]),
      error: null,
    });

    const result = await finalizeAudioUploadForJob({
      jobId: "job-1",
      storagePath: "org-1/session-1/job-1/recording.webm",
    });

    expect(result).toEqual({
      storagePath: null,
      error: "Uploaded audio content does not match a supported format",
    });
    expect(mockStorageRemove).toHaveBeenCalledWith([
      "org-1/session-1/job-1/recording.webm",
    ]);
    expect(mockDbFrom).not.toHaveBeenCalled();
  });

  it("does not attempt cleanup when the initial info check fails", async () => {
    mockStorageInfo.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const result = await finalizeAudioUploadForJob({
      jobId: "job-1",
      storagePath: "org-1/session-1/job-1/recording.webm",
    });

    expect(result).toEqual({
      storagePath: null,
      error: "not found",
    });
    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(mockDbFrom).not.toHaveBeenCalled();
  });

  it("preserves the original verification error when cleanup fails", async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: { message: "download failed" },
    });
    mockStorageRemove.mockRejectedValue(new Error("cleanup failed"));

    const result = await finalizeAudioUploadForJob({
      jobId: "job-1",
      storagePath: "org-1/session-1/job-1/recording.webm",
    });

    expect(result).toEqual({
      storagePath: null,
      error: "download failed",
    });
    expect(mockStorageRemove).toHaveBeenCalledWith([
      "org-1/session-1/job-1/recording.webm",
    ]);
  });
});
