import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export type AuditAction =
  | "session.created"
  | "session.viewed"
  | "session.updated"
  | "session.deleted"
  | "job.created"
  | "job.triggered"
  | "job.cancelled"
  | "audio.uploaded"
  | "audio.sent_to_vendor"
  | "transcript.created"
  | "transcript.sent_to_vendor"
  | "note.generated"
  | "note.edited"
  | "note.viewed"
  | "note.exported"
  | "carelogic_fields_generated"
  | "carelogic_fields_regenerated"
  | "consent.recorded"
  | "consent.part2_recorded"
  | "auth.login"
  | "auth.logout"
  | "auth.session_revoked";

export type AuditVendor =
  | "openai"
  | "anthropic"
  | "supabase"
  | "vercel"
  | "upstash"
  | null;

type AuditEntityType =
  | "session"
  | "job"
  | "note"
  | "transcript"
  | "consent"
  | "auth"
  | "system";

type AuditParams = {
  orgId: string;
  actorId?: string;
  sessionId?: string;
  jobId?: string;
  action: AuditAction;
  vendor?: AuditVendor;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  success?: boolean;
  errorCode?: string;
  metadata?: Record<string, unknown>;
};

function resolveEntity(params: AuditParams): {
  entityType: AuditEntityType;
  entityId: string | null;
} {
  if (params.jobId) {
    return { entityType: "job", entityId: params.jobId };
  }

  if (params.action.startsWith("auth.")) {
    return { entityType: "auth", entityId: null };
  }

  if (params.action.startsWith("consent.")) {
    return {
      entityType: "consent",
      entityId: params.sessionId ?? null,
    };
  }

  if (params.sessionId) {
    return { entityType: "session", entityId: params.sessionId };
  }

  return { entityType: "system", entityId: null };
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  if (!params.actorId) {
    return;
  }

  const { entityType, entityId } = resolveEntity(params);
  const db = createServiceClient();

  try {
    const { error } = await db.from("audit_log").insert({
      org_id: params.orgId,
      actor_id: params.actorId,
      action: params.action,
      entity_type: entityType,
      entity_id: entityId,
      vendor: params.vendor ?? null,
      request_id: params.requestId ?? null,
      error_code: params.errorCode ?? null,
      metadata: {
        ...(params.metadata ?? {}),
        session_id: params.sessionId ?? null,
        job_id: params.jobId ?? null,
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
        success: params.success ?? true,
      },
    });

    if (error) {
      console.error(
        "[audit] write failed for action:",
        params.action,
        "error:",
        error.message,
      );
    }
  } catch {
    console.error("[audit] write failed for action:", params.action);
  }
}
