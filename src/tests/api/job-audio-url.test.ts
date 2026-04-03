import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockGetMyJob,
  mockGetSignedAudioUrlForOrg,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMyJob: vi.fn(),
  mockGetSignedAudioUrlForOrg: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/jobs/queries", () => ({
  getMyJob: mockGetMyJob,
}));

vi.mock("@/lib/storage/audio", () => ({
  getSignedAudioUrlForOrg: mockGetSignedAudioUrlForOrg,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { GET } from "../../app/api/jobs/[id]/audio-url/route";

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
  return new Request("http://localhost:3000/api/jobs/job-1/audio-url", {
    method: "GET",
  });
}

describe("GET /api/jobs/[id]/audio-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetMyJob.mockResolvedValue({
      data: {
        id: "job-1",
        session_id: "session-1",
        audio_storage_path: "org-1/session-1/job-1/recording.webm",
      },
      error: null,
    });
    mockGetSignedAudioUrlForOrg.mockResolvedValue(
      "https://signed.example/audio.webm",
    );
  });

  it("returns a signed URL for the authenticated user's org-scoped audio path", async () => {
    const response = await GET(makeRequest() as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      url: "https://signed.example/audio.webm",
      filename: "recording.webm",
    });
    expect(mockGetSignedAudioUrlForOrg).toHaveBeenCalledWith(
      "org-1",
      "org-1/session-1/job-1/recording.webm",
    );
  });

  it("returns 404 when the job has no audio file", async () => {
    mockGetMyJob.mockResolvedValue({
      data: {
        id: "job-1",
        session_id: "session-1",
        audio_storage_path: null,
      },
      error: null,
    });

    const response = await GET(makeRequest() as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "No audio file" });
    expect(mockGetSignedAudioUrlForOrg).not.toHaveBeenCalled();
  });
});
