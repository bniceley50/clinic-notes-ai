import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockJobsRunnerToken,
  mockGetGlobalJobById,
  mockUpdateJobWorkerFieldsForOrg,
  mockCheckRateLimit,
  mockWorkerLimit,
  mockLogError,
} = vi.hoisted(() => ({
  mockJobsRunnerToken: vi.fn(),
  mockGetGlobalJobById: vi.fn(),
  mockUpdateJobWorkerFieldsForOrg: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWorkerLimit: { name: "worker-limit" },
  mockLogError: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  jobsRunnerToken: mockJobsRunnerToken,
}));

vi.mock("@/lib/jobs/queries", () => ({
  getGlobalJobById: mockGetGlobalJobById,
  updateJobWorkerFieldsForOrg: mockUpdateJobWorkerFieldsForOrg,
}));

vi.mock("@/lib/rate-limit", () => ({
  workerLimit: mockWorkerLimit,
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
  logError: mockLogError,
}));

import { POST } from "@/app/api/jobs/[id]/worker/route";

function makeRequest(authorization?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }

  return new Request("http://localhost:3000/api/jobs/job-1/worker", {
    method: "POST",
    headers,
    body: JSON.stringify({ status: "running" }),
  });
}

describe("POST /api/jobs/[id]/worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobsRunnerToken.mockReturnValue("runner-token");
    mockCheckRateLimit.mockResolvedValue(null);
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
    expect(mockGetGlobalJobById).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token is invalid", async () => {
    const response = await POST(makeRequest("Bearer wrong-token") as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
    expect(mockGetGlobalJobById).not.toHaveBeenCalled();
  });

  it("returns 409 when the bearer token is valid but the job is already terminal", async () => {
    mockGetGlobalJobById.mockResolvedValue({
      id: "job-1",
      session_id: "session-1",
      org_id: "org-1",
      created_by: "user-1",
      status: "failed",
      progress: 42,
      stage: "failed",
      note_type: "soap",
      attempt_count: 3,
      error_message: "JOB_PROCESSOR_ERROR",
      audio_storage_path: null,
      transcript_storage_path: null,
      draft_storage_path: null,
      claimed_at: null,
      lease_expires_at: null,
      run_token: null,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    });

    const response = await POST(makeRequest("Bearer runner-token") as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      error: {
        code: "JOB_STATUS_CONFLICT",
        message: "Job is not in a processable state.",
      },
    });
    expect(mockUpdateJobWorkerFieldsForOrg).not.toHaveBeenCalled();
  });
});
