import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockStorageInfo,
  mockStorageDownload,
  mockStorageRemove,
  mockStorageCreateSignedUrl,
  mockStorageFrom,
  mockEqId,
  mockEqSessionId,
  mockEqOrgId,
  mockJobsUpdate,
  mockDbFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockStorageInfo: vi.fn(),
  mockStorageDownload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockStorageCreateSignedUrl: vi.fn(),
  mockStorageFrom: vi.fn(() => ({
    info: mockStorageInfo,
    download: mockStorageDownload,
    remove: mockStorageRemove,
    createSignedUrl: mockStorageCreateSignedUrl,
  })),
  mockEqId: vi.fn(),
  mockEqSessionId: vi.fn(() => ({
    eq: mockEqId,
  })),
  mockEqOrgId: vi.fn(() => ({
    eq: mockEqSessionId,
  })),
  mockJobsUpdate: vi.fn(() => ({
    eq: mockEqOrgId,
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

import {
  finalizeJobAudioUploadForOrg,
  getSignedAudioUrlForOrg,
} from "@/lib/storage/audio";

describe("finalizeJobAudioUploadForOrg", () => {
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
    mockEqId.mockResolvedValue({ error: null });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/audio.webm" },
      error: null,
    });
  });

  it("deletes the uploaded object when download verification fails", async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: { message: "download failed" },
    });

    const result = await finalizeJobAudioUploadForOrg({
      orgId: "org-1",
      sessionId: "session-1",
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

    const result = await finalizeJobAudioUploadForOrg({
      orgId: "org-1",
      sessionId: "session-1",
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

    const result = await finalizeJobAudioUploadForOrg({
      orgId: "org-1",
      sessionId: "session-1",
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

    const result = await finalizeJobAudioUploadForOrg({
      orgId: "org-1",
      sessionId: "session-1",
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

  it("rejects a storage path that does not match the org-bound job context", async () => {
    const result = await finalizeJobAudioUploadForOrg({
      orgId: "org-1",
      sessionId: "session-1",
      jobId: "job-1",
      storagePath: "org-2/session-1/job-1/recording.webm",
    });

    expect(result).toEqual({
      storagePath: null,
      error: "Audio path does not match the job context",
    });
    expect(mockStorageInfo).not.toHaveBeenCalled();
    expect(mockDbFrom).not.toHaveBeenCalled();
  });
});

describe("getSignedAudioUrlForOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/audio.webm" },
      error: null,
    });
  });

  it("signs an audio path for the matching org", async () => {
    const result = await getSignedAudioUrlForOrg(
      "org-1",
      "org-1/session-1/job-1/recording.webm",
      900,
    );

    expect(result).toBe("https://signed.example/audio.webm");
    expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith(
      "org-1/session-1/job-1/recording.webm",
      900,
    );
  });

  it("rejects a storage path outside the caller org", async () => {
    await expect(
      getSignedAudioUrlForOrg(
        "org-1",
        "org-2/session-1/job-1/recording.webm",
      ),
    ).rejects.toThrow("Audio path does not belong to this org");

    expect(mockStorageCreateSignedUrl).not.toHaveBeenCalled();
  });
});
