import "server-only";

/**
 * Server-side session queries.
 *
 * All functions require an authenticated AppUser from the loader.
 * org_id and created_by are always set from the authenticated context,
 * never from user input.
 *
 * Uses the service role client (RLS bypass) because identity is
 * already verified by middleware + loader. The server enforces
 * ownership by filtering on userId/orgId from the session.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/loader";

export type SessionRow = {
  id: string;
  org_id: string;
  created_by: string;
  patient_label: string | null;
  session_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CreateSessionInput = {
  patient_label?: string;
  session_type?: "intake" | "follow-up" | "general";
};

export type UpdateSessionInput = {
  patient_label?: string | null;
  session_type?: "intake" | "follow-up" | "general";
  status?: "active" | "completed" | "archived";
};

const SESSION_COLUMNS =
  "id, org_id, created_by, patient_label, session_type, status, created_at, updated_at, completed_at";

const AUDIO_BUCKET = "audio";
const TRANSCRIPTS_BUCKET = process.env.TRANSCRIPT_BUCKET ?? "transcripts";
const DRAFTS_BUCKET = "drafts";

function isOrgAdmin(user: AppUser): boolean {
  return user.role === "admin";
}

export async function createSession(
  user: AppUser,
  input: CreateSessionInput,
): Promise<{ data: SessionRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("sessions")
    .insert({
      org_id: user.orgId,
      created_by: user.userId,
      patient_label: input.patient_label?.trim() || null,
      session_type: input.session_type ?? "general",
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as SessionRow, error: null };
}

export async function listMySessions(
  user: AppUser,
): Promise<{ data: SessionRow[]; error: string | null }> {
  const db = createServiceClient();

  let query = db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("org_id", user.orgId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (!isOrgAdmin(user)) {
    query = query.eq("created_by", user.userId);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as SessionRow[], error: null };
}

export async function getMySession(
  user: AppUser,
  sessionId: string,
): Promise<{ data: SessionRow | null; error: string | null }> {
  const db = createServiceClient();

  let query = db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("org_id", user.orgId)
    .limit(1);

  if (!isOrgAdmin(user)) {
    query = query.eq("created_by", user.userId);
  }

  const { data, error } = await query.single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as SessionRow, error: null };
}

export async function updateMySession(
  user: AppUser,
  sessionId: string,
  input: UpdateSessionInput,
): Promise<{ data: SessionRow | null; error: string | null }> {
  const db = createServiceClient();

  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  if ("patient_label" in input) {
    update.patient_label = input.patient_label?.trim() || null;
  }

  if (input.session_type) {
    update.session_type = input.session_type;
  }

  if (input.status) {
    update.status = input.status;
    update.completed_at =
      input.status === "completed" ? new Date().toISOString() : null;
  }

  let query = db
    .from("sessions")
    .update(update)
    .eq("id", sessionId)
    .eq("org_id", user.orgId)
    .select(SESSION_COLUMNS)
    .limit(1);

  if (!isOrgAdmin(user)) {
    query = query.eq("created_by", user.userId);
  }

  const { data, error } = await query.single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as SessionRow, error: null };
}

export async function archiveMySession(
  user: AppUser,
  sessionId: string,
): Promise<{ data: SessionRow | null; error: string | null }> {
  return updateMySession(user, sessionId, { status: "archived" });
}

export async function getSessionForOrg(
  orgId: string,
  sessionId: string,
): Promise<{ data: SessionRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as SessionRow | null, error: null };
}

type SessionJobArtifactRow = {
  id: string;
  audio_storage_path: string | null;
  transcript_storage_path: string | null;
  draft_storage_path: string | null;
};

export async function deleteSessionCascade(
  sessionId: string,
  orgId: string,
): Promise<{ deleted: true }> {
  const db = createServiceClient();

  const { data: jobs, error: jobsError } = await db
    .from("jobs")
    .select("id, audio_storage_path, transcript_storage_path, draft_storage_path")
    .eq("session_id", sessionId)
    .eq("org_id", orgId);

  if (jobsError) {
    throw new Error(`Failed to load jobs for session delete: ${jobsError.message}`);
  }

  const jobRows = (jobs ?? []) as SessionJobArtifactRow[];

  const { error: notesError } = await db
    .from("notes")
    .delete()
    .eq("session_id", sessionId)
    .eq("org_id", orgId);

  if (notesError) {
    throw new Error(`Failed to delete notes: ${notesError.message}`);
  }

  const { error: transcriptsError } = await db
    .from("transcripts")
    .delete()
    .eq("session_id", sessionId)
    .eq("org_id", orgId);

  if (transcriptsError) {
    throw new Error(`Failed to delete transcripts: ${transcriptsError.message}`);
  }

  const audioPaths = jobRows
    .map((job) => job.audio_storage_path)
    .filter((path): path is string => Boolean(path));
  if (audioPaths.length > 0) {
    const { error } = await db.storage.from(AUDIO_BUCKET).remove(audioPaths);
    if (error) {
      throw new Error(`Failed to delete audio files: ${error.message}`);
    }
  }

  const transcriptPaths = jobRows
    .map((job) => job.transcript_storage_path)
    .filter((path): path is string => Boolean(path));
  if (transcriptPaths.length > 0) {
    const { error } = await db.storage
      .from(TRANSCRIPTS_BUCKET)
      .remove(transcriptPaths);
    if (error) {
      throw new Error(`Failed to delete transcript files: ${error.message}`);
    }
  }

  const draftPaths = jobRows
    .map((job) => job.draft_storage_path)
    .filter((path): path is string => Boolean(path));
  if (draftPaths.length > 0) {
    const { error } = await db.storage.from(DRAFTS_BUCKET).remove(draftPaths);
    if (error) {
      throw new Error(`Failed to delete draft files: ${error.message}`);
    }
  }

  const { error: extractionsDeleteError } = await db
    .from("carelogic_field_extractions")
    .delete()
    .eq("session_id", sessionId)
    .eq("org_id", orgId);

  if (extractionsDeleteError) {
    throw new Error(
      `Failed to delete EHR extractions: ${extractionsDeleteError.message}`,
    );
  }

  const { error: jobsDeleteError } = await db
    .from("jobs")
    .delete()
    .eq("session_id", sessionId)
    .eq("org_id", orgId);

  if (jobsDeleteError) {
    throw new Error(`Failed to delete jobs: ${jobsDeleteError.message}`);
  }

  const { error: consentsDeleteError } = await db
    .from("session_consents")
    .delete()
    .eq("session_id", sessionId)
    .eq("org_id", orgId);

  if (consentsDeleteError) {
    throw new Error(`Failed to delete consent records: ${consentsDeleteError.message}`);
  }

  const { error: sessionDeleteError } = await db
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("org_id", orgId);

  if (sessionDeleteError) {
    throw new Error(`Failed to delete session: ${sessionDeleteError.message}`);
  }

  return { deleted: true };
}
