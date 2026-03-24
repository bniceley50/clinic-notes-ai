import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockJobsRunnerToken,
  mockListQueuedJobs,
  mockListExpiredRunningJobs,
  mockRequeueStaleLeasedJob,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockJobsRunnerToken: vi.fn(),
  mockListQueuedJobs: vi.fn(),
  mockListExpiredRunningJobs: vi.fn(),
  mockRequeueStaleLeasedJob: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  jobsRunnerToken: mockJobsRunnerToken,
}));

vi.mock("@/lib/jobs/queries", () => ({
  listQueuedJobs: mockListQueuedJobs,
  listExpiredRunningLeasedJobs: mockListExpiredRunningJobs,
  requeueStaleLeasedJob: mockRequeueStaleLeasedJob,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => "ip:127.0.0.1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("requeues expired running jobs before dispatching work", async () => {
    mockListExpiredRunningJobs.mockResolvedValue({
      data: [{ id: "expired-job-1" }],
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
    expect(mockRequeueStaleLeasedJob).toHaveBeenCalledWith("expired-job-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/jobs/queued-job-1/process",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(payload).toEqual({ processed: 1 });
  });

  it("does not requeue jobs when there are no expired running leases", async () => {
    const response = await GET(makeRequest() as never);

    expect(response.status).toBe(200);
    expect(mockListExpiredRunningJobs).toHaveBeenCalled();
    expect(mockRequeueStaleLeasedJob).not.toHaveBeenCalled();
  });
});
