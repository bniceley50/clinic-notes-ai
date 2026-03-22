import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockProfilesEq,
  mockJobsRunningLimit,
  mockJobsQueuedLimit,
  mockJobsFailedLimit,
  mockAuditLimit,
  mockCreateServiceClient,
} = vi.hoisted(() => {
  const mockProfilesEq = vi.fn();
  const mockJobsRunningLimit = vi.fn();
  const mockJobsQueuedLimit = vi.fn();
  const mockJobsFailedLimit = vi.fn();
  const mockAuditLimit = vi.fn();

  const mockCreateServiceClient = vi.fn(() => ({
    from: (table: string) => {
      switch (table) {
        case "profiles":
          return {
            select: () => ({
              eq: mockProfilesEq,
            }),
          };
        case "jobs":
          return {
            select: () => ({
              eq: () => ({
                eq: (_statusColumn: string, status: string) => {
                  if (status === "running") {
                    return {
                      lt: () => ({
                        order: () => ({
                          limit: mockJobsRunningLimit,
                        }),
                      }),
                    };
                  }

                  if (status === "queued") {
                    return {
                      lt: () => ({
                        order: () => ({
                          limit: mockJobsQueuedLimit,
                        }),
                      }),
                    };
                  }

                  if (status === "failed") {
                    return {
                      gte: () => ({
                        order: () => ({
                          limit: mockJobsFailedLimit,
                        }),
                      }),
                    };
                  }

                  throw new Error(`Unexpected status ${status}`);
                },
              }),
            }),
          };
        case "audit_log":
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: mockAuditLimit,
                }),
              }),
            }),
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
  }));

  return {
    mockProfilesEq,
    mockJobsRunningLimit,
    mockJobsQueuedLimit,
    mockJobsFailedLimit,
    mockAuditLimit,
    mockCreateServiceClient,
  };
});

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { getAdminHealthSnapshot } from "../../lib/admin/health";

describe("getAdminHealthSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockProfilesEq.mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          display_name: "Gillian",
          role: "provider",
        },
        {
          user_id: "user-2",
          display_name: "Brian",
          role: "admin",
        },
      ],
      error: null,
    });
    mockJobsRunningLimit.mockResolvedValue({
      data: [
        {
          id: "job-running-1",
          session_id: "session-1",
          created_by: "user-1",
          status: "running",
          stage: "transcribing",
          attempt_count: 2,
          error_message: null,
          created_at: "2026-03-22T19:00:00.000Z",
          updated_at: "2026-03-22T19:05:00.000Z",
        },
      ],
      error: null,
    });
    mockJobsQueuedLimit.mockResolvedValue({
      data: [
        {
          id: "job-queued-1",
          session_id: "session-2",
          created_by: "user-2",
          status: "queued",
          stage: "queued",
          attempt_count: 0,
          error_message: null,
          created_at: "2026-03-22T18:00:00.000Z",
          updated_at: "2026-03-22T18:00:00.000Z",
        },
      ],
      error: null,
    });
    mockJobsFailedLimit.mockResolvedValue({
      data: [
        {
          id: "job-failed-1",
          session_id: "session-3",
          created_by: "user-1",
          status: "failed",
          stage: "failed",
          attempt_count: 3,
          error_message: "Whisper timeout",
          created_at: "2026-03-22T17:00:00.000Z",
          updated_at: "2026-03-22T17:30:00.000Z",
        },
      ],
      error: null,
    });
    mockAuditLimit.mockResolvedValue({
      data: [
        {
          created_at: "2026-03-22T20:00:00.000Z",
          actor_id: "user-2",
          action: "job.cancelled",
          entity_type: "job",
          entity_id: "job-failed-1",
          metadata: {
            session_id: "session-3",
            job_id: "job-failed-1",
            success: true,
          },
        },
      ],
      error: null,
    });
  });

  it("returns org-scoped stuck jobs, recent failed jobs, and audit events with display names", async () => {
    const result = await getAdminHealthSnapshot("org-1");

    expect(result.error).toBeNull();
    expect(result.data?.summary).toEqual({
      stuckRunningCount: 1,
      stuckQueuedCount: 1,
      failedLast24HoursCount: 1,
    });
    expect(result.data?.stuckJobs).toEqual([
      expect.objectContaining({
        id: "job-queued-1",
        createdByName: "Brian",
        heuristic: "stuck_queued",
      }),
      expect.objectContaining({
        id: "job-running-1",
        createdByName: "Gillian",
        heuristic: "stuck_running",
      }),
    ]);
    expect(result.data?.failedJobs).toEqual([
      expect.objectContaining({
        id: "job-failed-1",
        errorMessage: "Whisper timeout",
        createdByName: "Gillian",
        heuristic: "failed_recent",
      }),
    ]);
    expect(result.data?.recentAuditEvents).toEqual([
      expect.objectContaining({
        actorName: "Brian",
        action: "job.cancelled",
        sessionId: "session-3",
        jobId: "job-failed-1",
        success: true,
      }),
    ]);
  });

  it("returns the first query error when health data cannot be loaded", async () => {
    mockJobsRunningLimit.mockResolvedValue({
      data: null,
      error: { message: "jobs exploded" },
    });

    const result = await getAdminHealthSnapshot("org-1");

    expect(result).toEqual({
      data: null,
      error: "jobs exploded",
    });
  });
});
