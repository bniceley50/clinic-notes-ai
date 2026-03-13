import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetMyJob,
  mockCreateSignedAudioUpload,
  mockBuildAudioStoragePath,
  mockFinalizeAudioUploadForJob,
  mockCheckRateLimit,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMyJob: vi.fn(),
  mockCreateSignedAudioUpload: vi.fn(),
  mockBuildAudioStoragePath: vi.fn(),
  mockFinalizeAudioUploadForJob: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/jobs/queries", () => ({
  getMyJob: mockGetMyJob,
}));

vi.mock("@/lib/storage/audio", () => ({
  createSignedAudioUpload: mockCreateSignedAudioUpload,
  buildAudioStoragePath: mockBuildAudioStoragePath,
  finalizeAudioUploadForJob: mockFinalizeAudioUploadForJob,
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

import { POST as postUploadUrl } from "../../app/api/jobs/[id]/upload-url/route";
import { POST as postUploadComplete } from "../../app/api/jobs/[id]/upload-complete/route";

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

const ownedJob = {
  id: "job-1",
  session_id: "session-1",
  status: "queued",
  audio_storage_path: null,
};

describe("POST /api/jobs/[id]/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMyJob.mockResolvedValue({ data: ownedJob, error: null });
    mockCreateSignedAudioUpload.mockResolvedValue({
      path: "org-1/session-1/job-1/test.webm",
      token: "signed-token",
      error: null,
    });
  });

  it("returns a signed upload URL for an authenticated owner", async () => {
    const request = new Request("http://localhost:3000/api/jobs/job-1/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "test.webm", contentType: "audio/webm" }),
    });

    const response = await postUploadUrl(request as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      path: "org-1/session-1/job-1/test.webm",
      token: "signed-token",
    });
    expect(mockGetMyJob).toHaveBeenCalledWith(authenticatedResult.user, "job-1");
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockLoadCurrentUser.mockResolvedValue({ status: "no_session" });

    const request = new Request("http://localhost:3000/api/jobs/job-1/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "test.webm", contentType: "audio/webm" }),
    });

    const response = await postUploadUrl(request as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when another user's job is requested", async () => {
    mockGetMyJob.mockResolvedValue({ data: null, error: "not found" });

    const request = new Request("http://localhost:3000/api/jobs/job-2/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "test.webm", contentType: "audio/webm" }),
    });

    const response = await postUploadUrl(request as never, {
      params: Promise.resolve({ id: "job-2" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Job not found" });
  });

  it("returns 404 for an invalid job ID", async () => {
    mockGetMyJob.mockResolvedValue({ data: null, error: "not found" });

    const request = new Request("http://localhost:3000/api/jobs/not-a-job/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "test.webm", contentType: "audio/webm" }),
    });

    const response = await postUploadUrl(request as never, {
      params: Promise.resolve({ id: "not-a-job" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Job not found" });
  });
});

describe("POST /api/jobs/[id]/upload-complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMyJob.mockResolvedValue({ data: ownedJob, error: null });
    mockBuildAudioStoragePath.mockReturnValue("org-1/session-1/job-1/test.webm");
    mockFinalizeAudioUploadForJob.mockResolvedValue({
      storagePath: "org-1/session-1/job-1/test.webm",
      error: null,
    });
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("completes upload finalization for an authenticated owner", async () => {
    const request = new Request("http://localhost:3000/api/jobs/job-1/upload-complete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-id": "upload-complete-request-id",
      },
      body: JSON.stringify({ fileName: "test.webm", fileSizeBytes: 1024 }),
    });

    const response = await postUploadComplete(request as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      job_id: "job-1",
      audio_storage_path: "org-1/session-1/job-1/test.webm",
    });
    expect(mockGetMyJob).toHaveBeenCalledWith(authenticatedResult.user, "job-1");
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      actorId: "user-1",
      sessionId: "session-1",
      jobId: "job-1",
      action: "audio.uploaded",
      requestId: "upload-complete-request-id",
      metadata: { file_size_bytes: 1024 },
    });
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockLoadCurrentUser.mockResolvedValue({ status: "no_session" });

    const request = new Request("http://localhost:3000/api/jobs/job-1/upload-complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "test.webm" }),
    });

    const response = await postUploadComplete(request as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when another user's job is requested", async () => {
    mockGetMyJob.mockResolvedValue({ data: null, error: "not found" });

    const request = new Request("http://localhost:3000/api/jobs/job-2/upload-complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "test.webm" }),
    });

    const response = await postUploadComplete(request as never, {
      params: Promise.resolve({ id: "job-2" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Job not found" });
  });

  it("returns 404 for an invalid job ID", async () => {
    mockGetMyJob.mockResolvedValue({ data: null, error: "not found" });

    const request = new Request("http://localhost:3000/api/jobs/not-a-job/upload-complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "test.webm" }),
    });

    const response = await postUploadComplete(request as never, {
      params: Promise.resolve({ id: "not-a-job" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Job not found" });
  });
});