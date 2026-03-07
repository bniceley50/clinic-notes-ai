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
  created_at: string;
  updated_at: string;
};

export type CreateJobInput = {
  session_id: string;
  note_type?: "soap" | "dap" | "birp" | "girp" | "intake" | "progress";
};

const JOB_COLUMNS =
  "id, session_id, org_id, created_by, status, progress, stage, note_type, attempt_count, error_message, audio_storage_path, created_at, updated_at";

const UNIQUE_VIOLATION = "23505";

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

  const { data, error } = await db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("session_id", sessionId)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as JobRow[], error: null };
}

export async function getMyJob(
  user: AppUser,
  jobId: string,
): Promise<{ data: JobRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as JobRow, error: null };
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
    .single();

  if (error) return null;
  return data as JobRow;
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
    .select(JOB_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as JobRow, error: null };
}
