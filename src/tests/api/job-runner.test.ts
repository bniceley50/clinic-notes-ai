import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockJobsRunnerToken,
  mockListQueuedJobs,
  mockListExpiredRunningJobs,
  mockRequeueStaleLeasedJob,
  mockCheckRateLimit,
  mockCleanupSoftDeletedArtifactsGlobally,
  mockWorkerLimit,
  mockCaptureCheckIn,
  mockFlush,
} = vi.hoisted(() => ({
  mockJobsRunnerToken: vi.fn(),
  mockListQueuedJobs: vi.fn(),
  mockListExpiredRunningJobs: vi.fn(),
  mockRequeueStaleLeasedJob: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockCleanupSoftDeletedArtifactsGlobally: vi.fn(),
  mockWorkerLimit: { name: "worker-limit" },
  mockCaptureCheckIn: vi.fn(() => "check-in-1"),
  mockFlush: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/config", () => ({
  jobsRunnerToken: mockJobsRunnerToken,
}));

vi.mock("@/lib/jobs/queries", () => ({
  listQueuedJobsGlobally: mockListQueuedJobs,
  listExpiredRunningLeasedJobsGlobally: mockListExpiredRunningJobs,
  requeueStaleLeasedJobForOrg: mockRequeueStaleLeasedJob,
}));

vi.mock("@/lib/storage/cleanup", () => ({
  cleanupSoftDeletedArtifactsGlobally: mockCleanupSoftDeletedArtifactsGlobally,
}));

vi.mock("@/lib/rate-limit", () => ({
  workerLimit: mockWorkerLimit,
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

vi.mock("@sentry/nextjs", () => ({
  captureCheckIn: mockCaptureCheckIn,
  flush: mockFlush,
}));

import { GET } from "../../app/api/jobs/runner/route";

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/jobs/runner", {
    method: "GET",
    headers: {
      authorization: "Bearer runner-token",
    },
  });
}

describe("GET /api/jobs/runner", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    process.env.CRON_SECRET = "cron-secret";

    mockJobsRunnerToken.mockReturnValue("runner-token");
    mockCheckRateLimit.mockResolvedValue(null);
    mockListQueuedJobs.mockResolvedValue({
      data: [{ id: "queued-job-1" }],
      error: null,
    });
    mockListExpiredRunningJobs.mockResolvedValue({
      data: [],
      error: null,
    });
    mockRequeueStaleLeasedJob.mockResolvedValue({
      data: null,
      error: null,
    });
    mockCleanupSoftDeletedArtifactsGlobally.mockResolvedValue({
      cleaned: 0,
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("requeues expired running jobs before dispatching work", async () => {
    mockListExpiredRunningJobs.mockResolvedValue({
      data: [{ id: "expired-job-1", org_id: "org-1" }],
      error: null,
    });
    mockRequeueStaleLeasedJob.mockResolvedValue({
      data: { id: "expired-job-1", status: "queued" },
      error: null,
    });

    const response = await GET(makeRequest() as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockListExpiredRunningJobs).toHaveBeenCalled();
    expect(mockRequeueStaleLeasedJob).toHaveBeenCalledWith("org-1", "expired-job-1");
    expect(mockCheckRateLimit).toHaveBeenCalledWith(mockWorkerLimit, "worker:runner");
    expect(mockCaptureCheckIn).toHaveBeenNthCalledWith(
      1,
      {
        monitorSlug: "jobs-runner",
        status: "in_progress",
      },
      {
        schedule: {
          type: "crontab",
          value: "* * * * *",
        },
        checkinMargin: 2,
        maxRuntime: 1,
        timezone: "UTC",
      },
    );
    expect(mockCaptureCheckIn).toHaveBeenNthCalledWith(2, {
      checkInId: "check-in-1",
      monitorSlug: "jobs-runner",
      status: "ok",
    });
    expect(mockFlush).toHaveBeenCalledWith(2000);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/jobs/queued-job-1/process",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(mockCleanupSoftDeletedArtifactsGlobally).toHaveBeenCalledTimes(1);
    expect(payload).toEqual({ processed: 1 });
  });

  it("does not requeue jobs when there are no expired running leases", async () => {
    const response = await GET(makeRequest() as never);

    expect(response.status).toBe(200);
    expect(mockListExpiredRunningJobs).toHaveBeenCalled();
    expect(mockRequeueStaleLeasedJob).not.toHaveBeenCalled();
  });

  it("reports an error check-in when the runner token is missing", async () => {
    mockJobsRunnerToken.mockReturnValue("");

    const response = await GET(makeRequest() as never);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: "Runner endpoint not configured" });
    expect(mockCaptureCheckIn).toHaveBeenNthCalledWith(
      1,
      {
        monitorSlug: "jobs-runner",
        status: "in_progress",
      },
      expect.any(Object),
    );
    expect(mockCaptureCheckIn).toHaveBeenNthCalledWith(2, {
      checkInId: "check-in-1",
      monitorSlug: "jobs-runner",
      status: "error",
    });
    expect(mockFlush).toHaveBeenCalledWith(2000);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });
});
