import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockOrder,
  mockNot,
  mockIsDeleted,
  mockEqStatus,
  mockSelect,
  mockFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => {
  const mockOrder = vi.fn(async () => ({
    data: [{ id: "job-1", audio_storage_path: "org-1/session-1/job-1/recording.webm" }],
    error: null,
  }));
  const mockNot = vi.fn(() => ({
    order: mockOrder,
  }));
  const mockIsDeleted = vi.fn(() => ({
    not: mockNot,
  }));
  const mockEqStatus = vi.fn(() => ({
    is: mockIsDeleted,
  }));
  const mockSelect = vi.fn(() => ({
    eq: mockEqStatus,
  }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
  }));
  const mockCreateServiceClient = vi.fn(() => ({
    from: mockFrom,
  }));

  return {
    mockOrder,
    mockNot,
    mockIsDeleted,
    mockEqStatus,
    mockSelect,
    mockFrom,
    mockCreateServiceClient,
  };
});

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { listQueuedJobs } from "../../lib/jobs/queries";

describe("listQueuedJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only returns queued jobs that have uploaded audio", async () => {
    const result = await listQueuedJobs();

    expect(mockFrom).toHaveBeenCalledWith("jobs");
    expect(mockSelect).toHaveBeenCalled();
    expect(mockEqStatus).toHaveBeenCalledWith("status", "queued");
    expect(mockIsDeleted).toHaveBeenCalledWith("deleted_at", null);
    expect(mockNot).toHaveBeenCalledWith("audio_storage_path", "is", null);
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toEqual({
      data: [{ id: "job-1", audio_storage_path: "org-1/session-1/job-1/recording.webm" }],
      error: null,
    });
  });
});
