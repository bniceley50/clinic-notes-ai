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

  const { data, error } = await db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

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

  const { data, error } = await db
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .single();

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

  const { data, error } = await db
    .from("sessions")
    .update(update)
    .eq("id", sessionId)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .select(SESSION_COLUMNS)
    .single();

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
