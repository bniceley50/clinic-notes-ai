import "server-only";

/**
 * Server-side job queries.
 *
 * All functions require an authenticated AppUser from the loader.
 * org_id and created_by are always set from the authenticated context,
 * never from user input.
 *
 * The DB enforces one active (queued/running) job per session via
 * idx_jobs_one_active_per_session partial unique index.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/loader";

export type JobRow = {
  id: string;
  session_id: string;
  org_id: string;
  created_by: string;
  status: string;
  progress: number;
  stage: string;
  note_type: string;
  attempt_count: number;
  error_message: string | null;
  audio_storage_path: string | null;
  transcript_storage_path: string | null;
  draft_storage_path: string | null;
  claimed_at: string | null;
  lease_expires_at: string | null;
  run_token: string | null;
  created_at: string;
  updated_at: string;
};

export const JOB_NOTE_TYPES = [
  "soap",
  "dap",
  "birp",
  "girp",
  "intake",
  "progress",
] as const;

export type JobNoteType = (typeof JOB_NOTE_TYPES)[number];

export type CreateJobInput = {
  session_id: string;
  note_type?: JobNoteType;
};

const JOB_COLUMNS =
  "id, session_id, org_id, created_by, status, progress, stage, note_type, attempt_count, error_message, audio_storage_path, transcript_storage_path, draft_storage_path, claimed_at, lease_expires_at, run_token, created_at, updated_at";

const UNIQUE_VIOLATION = "23505";

function isOrgAdmin(user: AppUser): boolean {
  return user.role === "admin";
}

export async function createJob(
  user: AppUser,
  input: CreateJobInput,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .insert({
      session_id: input.session_id,
      org_id: user.orgId,
      created_by: user.userId,
      status: "queued",
      stage: "queued",
      note_type: input.note_type ?? "soap",
    })
    .select(JOB_COLUMNS)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        data: null,
        error: "This session already has an active job. Wait for it to finish or cancel it first.",
      };
    }
    return { data: null, error: error.message };
  }

  return { data: data as JobRow, error: null };
}

export async function getJobsForSession(
  user: AppUser,
  sessionId: string,
): Promise<{ data: JobRow[]; error: string | null }> {
  const db = createServiceClient();

  let query = db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("session_id", sessionId)
    .eq("org_id", user.orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!isOrgAdmin(user)) {
    query = query.eq("created_by", user.userId);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as JobRow[], error: null };
}

export async function getActiveJobForSession(
  user: AppUser,
  sessionId: string,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  let query = db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("session_id", sessionId)
    .eq("org_id", user.orgId)
    .is("deleted_at", null)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (!isOrgAdmin(user)) {
    query = query.eq("created_by", user.userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as JobRow | null, error: null };
}

export async function getMyJob(
  user: AppUser,
  jobId: string,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  let query = db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .eq("org_id", user.orgId)
    .is("deleted_at", null)
    .limit(1);

  if (!isOrgAdmin(user)) {
    query = query.eq("created_by", user.userId);
  }

  const { data, error } = await query.single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as JobRow, error: null };
}

export async function getJobForOrg(
  user: AppUser,
  jobId: string,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .eq("org_id", user.orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as JobRow | null, error: null };
}

/**
 * Fetch a job by ID without ownership check. Used by the worker
 * endpoint to validate transitions before applying updates.
 */
export async function getJobById(
  jobId: string,
): Promise<JobRow | null> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .is("deleted_at", null)
    .single();

  if (error) return null;
  return data as JobRow;
}

export async function listQueuedJobs(): Promise<{
  data: JobRow[];
  error: string | null;
}> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("status", "queued")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as JobRow[], error: null };
}

export async function listExpiredRunningLeasedJobs(): Promise<{
  data: JobRow[];
  error: string | null;
}> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("status", "running")
    .is("deleted_at", null)
    .lte("lease_expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as JobRow[], error: null };
}

export async function claimJobForProcessing(
  jobId: string,
  leaseDurationSeconds: number,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db.rpc("claim_job_for_processing", {
    p_job_id: jobId,
    p_lease_seconds: leaseDurationSeconds,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  const claimed = Array.isArray(data) ? data[0] : null;
  return { data: (claimed ?? null) as JobRow | null, error: null };
}

/**
 * Update worker-owned fields on a job. Only callable from the
 * backend worker endpoint — never from browser code.
 */
export async function updateJobWorkerFields(
  jobId: string,
  fields: Record<string, unknown>,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .is("deleted_at", null)
    .select(JOB_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as JobRow, error: null };
}

export async function updateClaimedJobWorkerFields(
  jobId: string,
  runToken: string,
  fields: Record<string, unknown>,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("run_token", runToken)
    .is("deleted_at", null)
    .select(JOB_COLUMNS)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as JobRow | null, error: null };
}

export async function requeueStaleLeasedJob(
  jobId: string,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .update({
      status: "queued",
      stage: "queued",
      claimed_at: null,
      lease_expires_at: null,
      run_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "running")
    .is("deleted_at", null)
    .lte("lease_expires_at", new Date().toISOString())
    .select(JOB_COLUMNS)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as JobRow | null, error: null };
}
