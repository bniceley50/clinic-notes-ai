import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockProcessJob, mockCheckRateLimit, mockWorkerLimit } = vi.hoisted(() => ({
  mockProcessJob: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWorkerLimit: { name: "worker-limit" },
}));

vi.mock("@/lib/jobs/processor", () => ({
  processJob: mockProcessJob,
}));

vi.mock("@/lib/rate-limit", () => ({
  workerLimit: mockWorkerLimit,
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { POST } from "../../app/api/jobs/[id]/process/route";

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/jobs/job-1/process", {
    method: "POST",
    headers: {
      authorization: "Bearer runner-token",
    },
  });
}

describe("POST /api/jobs/[id]/process", () => {
  const originalRunnerToken = process.env.JOBS_RUNNER_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOBS_RUNNER_TOKEN = "runner-token";
    mockCheckRateLimit.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.JOBS_RUNNER_TOKEN = originalRunnerToken;
  });

  it("returns 202 when the job is already running", async () => {
    mockProcessJob.mockResolvedValue({
      success: true,
      error: null,
      alreadyRunning: true,
    });

    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(mockWorkerLimit, "worker:process:job-1");
    expect(payload).toEqual({ job_id: "job-1", status: "processing" });
  });

  it("returns 200 when processing completed in this request", async () => {
    mockProcessJob.mockResolvedValue({
      success: true,
      error: null,
    });

    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ job_id: "job-1", status: "processing" });
  });
});
