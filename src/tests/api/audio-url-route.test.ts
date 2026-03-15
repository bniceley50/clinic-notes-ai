import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadCurrentUser,
  mockCreateServiceClient,
  mockCreateSignedAudioDownloadUrl,
  mockCheckRateLimit,
  mockEq,
  mockMaybeSingle,
} = vi.hoisted(() => {
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();
  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
  };
  mockEq.mockImplementation(() => queryBuilder);

  return {
    mockLoadCurrentUser: vi.fn(),
    mockCreateServiceClient: vi.fn(() => ({
      from: vi.fn(() => queryBuilder),
    })),
    mockCreateSignedAudioDownloadUrl: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockEq,
    mockMaybeSingle,
  };
});

vi.mock("@/lib/auth/loader", () => ({
  loadCurrentUser: mockLoadCurrentUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("@/lib/storage/audio", () => ({
  createSignedAudioDownloadUrl: mockCreateSignedAudioDownloadUrl,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => "user:user-1"),
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  withLogging: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { GET as getAudioUrl } from "../../app/api/jobs/[id]/audio-url/route";

const providerResult = {
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
      created_at: "2026-03-15T10:00:00.000Z",
    },
    org: {
      id: "org-1",
      name: "Org One",
      created_at: "2026-03-15T10:00:00.000Z",
    },
  },
};

describe("GET /api/jobs/[id]/audio-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCurrentUser.mockResolvedValue(providerResult);
    mockCheckRateLimit.mockResolvedValue(null);
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "job-1",
        created_by: "user-1",
        audio_storage_path: "org-1/session-1/job-1/recording.webm",
      },
      error: null,
    });
    mockCreateSignedAudioDownloadUrl.mockResolvedValue({
      url: "https://signed.example/audio.webm",
      error: null,
    });
  });

  it("returns a signed audio url for an authenticated owner", async () => {
    const request = new Request("http://localhost:3000/api/jobs/job-1/audio-url");

    const response = await getAudioUrl(request as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ url: "https://signed.example/audio.webm" });
    expect(mockEq).toHaveBeenCalledWith("created_by", "user-1");
    expect(mockCreateSignedAudioDownloadUrl).toHaveBeenCalledWith(
      "org-1/session-1/job-1/recording.webm",
      3600,
    );
  });

  it("allows admins to fetch audio without created_by filter", async () => {
    mockLoadCurrentUser.mockResolvedValue({
      ...providerResult,
      user: { ...providerResult.user, role: "admin" },
    });

    const request = new Request("http://localhost:3000/api/jobs/job-1/audio-url");
    const response = await getAudioUrl(request as never, {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockEq).not.toHaveBeenCalledWith("created_by", "user-1");
  });

  it("returns 404 when audio is missing", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "job-1",
        created_by: "user-1",
        audio_storage_path: null,
      },
      error: null,
    });

    const request = new Request("http://localhost:3000/api/jobs/job-1/audio-url");
    const response = await getAudioUrl(request as never, {
      params: Promise.resolve({ id: "job-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Audio not found" });
  });
});
