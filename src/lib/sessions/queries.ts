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
  deleted_at: string | null;
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
  "id, org_id, created_by, patient_label, session_type, status, created_at, updated_at, completed_at, deleted_at";

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
    .is("deleted_at", null)
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
    .is("deleted_at", null)
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
    .is("deleted_at", null)
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
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as SessionRow | null, error: null };
}

export async function softDeleteSession(
  sessionId: string,
  orgId: string,
): Promise<SessionRow> {
  const db = createServiceClient();

  const { data: session, error: sessionLoadError } = await db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (sessionLoadError) {
    throw new Error(`Failed to load session: ${sessionLoadError.message}`);
  }

  if (!session) {
    throw new Error("Failed to soft-delete session: session not found");
  }

  const sessionRow = session as SessionRow;
  if (sessionRow.deleted_at) {
    return sessionRow;
  }

  const deletedAt = new Date().toISOString();

  const markDeleted = async (table: string, label: string) => {
    const { error } = await db
      .from(table)
      .update({ deleted_at: deletedAt })
      .eq("session_id", sessionId)
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to soft-delete ${label}: ${error.message}`);
    }
  };

  await markDeleted("notes", "notes");
  await markDeleted("transcripts", "transcripts");
  await markDeleted("carelogic_field_extractions", "EHR extractions");
  await markDeleted("jobs", "jobs");
  await markDeleted("session_consents", "consent records");

  const { error: sessionUpdateError } = await db
    .from("sessions")
    .update({ deleted_at: deletedAt })
    .eq("id", sessionId)
    .eq("org_id", orgId)
    .is("deleted_at", null);

  if (sessionUpdateError) {
    throw new Error(`Failed to soft-delete session: ${sessionUpdateError.message}`);
  }

  return {
    ...sessionRow,
    deleted_at: deletedAt,
  };
}
