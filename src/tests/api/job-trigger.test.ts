import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetMyJob,
  mockCheckRateLimit,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMyJob: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/jobs/queries", () => ({
  getMyJob: mockGetMyJob,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { POST } from "../../app/api/jobs/[id]/trigger/route";

const authenticatedResult = {
  status: "authenticated" as const,
  user: {
    userId: "user-1",
    orgId: "org-1",
    role: "provider",
    email: "user@example.com",
    profile: {
      id: "profile-1",
      user_id: "user-1",
      org_id: "org-1",
      display_name: "User One",
      role: "provider",
      created_at: "2026-03-09T10:00:00.000Z",
    },
    org: {
      id: "org-1",
      name: "Org One",
      created_at: "2026-03-09T10:00:00.000Z",
    },
  },
};

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/jobs/job-1/trigger", {
    method: "POST",
    headers: {
      "x-vercel-id": "trigger-request-id",
    },
  });
}

describe("POST /api/jobs/[id]/trigger", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalRunnerToken = process.env.JOBS_RUNNER_TOKEN;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    process.env.NEXT_PUBLIC_APP_URL = "https://clinicnotes.ai";
    process.env.JOBS_RUNNER_TOKEN = "runner-token";

    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMyJob.mockResolvedValue({
      data: {
        id: "job-1",
        session_id: "session-1",
      },
      error: null,
    });
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    process.env.JOBS_RUNNER_TOKEN = originalRunnerToken;
  });

  it("returns 500 and does not audit when the process call fails", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "Failed to start processing",
    });
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("returns 500 and does not audit when the process route returns an error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Worker unavailable" }), {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "Worker unavailable",
    });
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("returns 202 and audits only after processing start is confirmed", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ job_id: "job-1", status: "processing" }), {
        status: 202,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toEqual({
      job_id: "job-1",
      status: "processing",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinicnotes.ai/api/jobs/job-1/process",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer runner-token",
        },
      },
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      jobId: "job-1",
      action: "job.triggered",
      requestId: "trigger-request-id",
    });
  });
});
