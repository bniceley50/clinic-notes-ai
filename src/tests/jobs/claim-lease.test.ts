import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const {
  mockRpc,
  mockMaybeSingle,
  mockSelect,
  mockIsDeleted,
  mockEqOrgId,
  mockEqRunToken,
  mockEqId,
  mockUpdate,
  mockFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockSelect: vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  })),
  mockIsDeleted: vi.fn(() => ({
    select: mockSelect,
  })),
  mockEqRunToken: vi.fn(() => ({
    is: mockIsDeleted,
  })),
  mockEqId: vi.fn(() => ({
    eq: mockEqRunToken,
  })),
  mockEqOrgId: vi.fn(() => ({
    eq: mockEqId,
  })),
  mockUpdate: vi.fn(() => ({
    eq: mockEqOrgId,
  })),
  mockFrom: vi.fn(() => ({
    update: mockUpdate,
  })),
  mockCreateServiceClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

vi.mock("../../lib/supabase/server", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import {
  claimJobForProcessingGlobally,
  updateClaimedJobWorkerFieldsForOrg,
} from "../../lib/jobs/queries";

const supabaseUrl = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

const envReady = Boolean(anonKey && serviceRoleKey);
const describeIntegration = envReady ? describe : describe.skip;

const baseJob = {
  id: "job-1",
  session_id: "session-1",
  org_id: "org-1",
  created_by: "user-1",
  status: "running",
  progress: 10,
  stage: "transcribing",
  note_type: "soap",
  attempt_count: 1,
  error_message: null,
  audio_storage_path: null,
  transcript_storage_path: null,
  draft_storage_path: null,
  claimed_at: "2026-03-22T00:00:00.000Z",
  lease_expires_at: "2026-03-22T00:05:00.000Z",
  run_token: "run-token-1",
  created_at: "2026-03-22T00:00:00.000Z",
  updated_at: "2026-03-22T00:00:00.000Z",
};

describe("claim/lease query helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claimJobForProcessingGlobally returns the claimed row from rpc()", async () => {
    mockRpc.mockResolvedValue({
      data: [baseJob],
      error: null,
    });

    const result = await claimJobForProcessingGlobally("job-1", 300);

    expect(mockRpc).toHaveBeenCalledWith("claim_job_for_processing", {
      p_job_id: "job-1",
      p_lease_seconds: 300,
    });
    expect(result).toEqual({
      data: baseJob,
      error: null,
    });
  });

  it("claimJobForProcessingGlobally returns null when no row was claimed", async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await claimJobForProcessingGlobally("job-1", 300);

    expect(result).toEqual({
      data: null,
      error: null,
    });
  });

  it("updateClaimedJobWorkerFieldsForOrg updates only when the run token matches", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        ...baseJob,
        status: "complete",
        progress: 100,
      },
      error: null,
    });

    const result = await updateClaimedJobWorkerFieldsForOrg("org-1", "job-1", "run-token-1", {
      status: "complete",
      progress: 100,
    });

    expect(mockFrom).toHaveBeenCalledWith("jobs");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        progress: 100,
        updated_at: expect.any(String),
      }),
    );
    expect(mockEqOrgId).toHaveBeenCalledWith("org_id", "org-1");
    expect(mockEqId).toHaveBeenCalledWith("id", "job-1");
    expect(mockEqRunToken).toHaveBeenCalledWith("run_token", "run-token-1");
    expect(result).toEqual({
      data: {
        ...baseJob,
        status: "complete",
        progress: 100,
      },
      error: null,
    });
  });

  it("updateClaimedJobWorkerFieldsForOrg returns null when the run token is stale", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await updateClaimedJobWorkerFieldsForOrg("org-1", "job-1", "stale-token", {
      progress: 25,
    });

    expect(result).toEqual({
      data: null,
      error: null,
    });
  });
});

describeIntegration("claim/lease integration", () => {
  let admin: SupabaseClient;
  let orgId: string;
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    admin = createClient(supabaseUrl, serviceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("org_id, user_id")
      .limit(1)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to load integration profile: ${profileError?.message ?? "unknown"}`);
    }

    orgId = profile.org_id;
    userId = profile.user_id;

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .insert({
        org_id: orgId,
        created_by: userId,
        patient_label: "Claim Lease Harness",
        session_type: "general",
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      throw new Error(`Failed to seed integration session: ${sessionError?.message ?? "unknown"}`);
    }

    sessionId = session.id;
  });

  async function insertQueuedJob(): Promise<string> {
    const { data, error } = await admin
      .from("jobs")
      .insert({
        session_id: sessionId,
        org_id: orgId,
        created_by: userId,
        status: "queued",
        stage: "queued",
        note_type: "soap",
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Failed to seed job: ${error?.message ?? "unknown"}`);
    }

    return data.id;
  }

  async function directClaim(jobId: string, leaseSeconds: number) {
    const { data, error } = await admin.rpc("claim_job_for_processing", {
      p_job_id: jobId,
      p_lease_seconds: leaseSeconds,
    });

    return {
      data: Array.isArray(data) ? data[0] ?? null : null,
      error,
    };
  }

  it("claimJobForProcessingGlobally succeeds on a queued job and sets claim metadata", async () => {
    const jobId = await insertQueuedJob();

    const result = await directClaim(jobId, 300);

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(jobId);
    expect(result.data?.status).toBe("running");
    expect(result.data?.stage).toBe("transcribing");
    expect(result.data?.attempt_count).toBe(1);
    expect(result.data?.run_token).toBeTruthy();
    expect(result.data?.lease_expires_at).toBeTruthy();
  });

  it("claimJobForProcessingGlobally returns null for an already-running job", async () => {
    const jobId = await insertQueuedJob();
    const claimed = await directClaim(jobId, 300);

    expect(claimed.data).not.toBeNull();

    const secondClaim = await directClaim(jobId, 300);

    expect(secondClaim).toEqual({
      data: null,
      error: null,
    });
  });

  it("claimJobForProcessingGlobally returns null when a live lease already exists", async () => {
    const jobId = await insertQueuedJob();
    const futureLease = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await admin
      .from("jobs")
      .update({
        lease_expires_at: futureLease,
      })
      .eq("id", jobId);

    if (error) {
      throw new Error(`Failed to seed lease expiry: ${error.message}`);
    }

    const result = await directClaim(jobId, 300);

    expect(result).toEqual({
      data: null,
      error: null,
    });
  });

  it("updateClaimedJobWorkerFieldsForOrg succeeds with the correct run_token", async () => {
    const jobId = await insertQueuedJob();
    const claimed = await directClaim(jobId, 300);

    if (!claimed.data?.run_token) {
      throw new Error("Expected claimed job to have a run token");
    }

    const updatedAt = new Date().toISOString();
    const { data, error } = await admin
      .from("jobs")
      .update({
        progress: 42,
        updated_at: updatedAt,
      })
      .eq("id", jobId)
      .eq("run_token", claimed.data.run_token)
      .select("*")
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.progress).toBe(42);
    expect(data?.run_token).toBe(claimed.data.run_token);
  });

  it("updateClaimedJobWorkerFieldsForOrg returns null with the wrong run_token", async () => {
    const jobId = await insertQueuedJob();
    const claimed = await directClaim(jobId, 300);

    expect(claimed.data).not.toBeNull();

    const { data, error } = await admin
      .from("jobs")
      .update({
        progress: 55,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("run_token", "00000000-0000-0000-0000-000000000000")
      .select("*")
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("concurrent claims produce exactly one success and one null", async () => {
    const jobId = await insertQueuedJob();

    const [first, second] = await Promise.all([
      directClaim(jobId, 300),
      directClaim(jobId, 300),
    ]);

    const successes = [first, second].filter((result) => result.data !== null);
    const misses = [first, second].filter(
      (result) => result.data === null && result.error === null,
    );

    expect(successes).toHaveLength(1);
    expect(misses).toHaveLength(1);
    expect(successes[0]?.data?.attempt_count).toBe(1);
    expect(successes[0]?.data?.run_token).toBeTruthy();
  });
});
