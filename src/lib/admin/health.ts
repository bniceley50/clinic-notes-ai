import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

const STUCK_JOB_THRESHOLD_MINUTES = 15;
const FAILED_JOB_WINDOW_HOURS = 24;
const STUCK_JOB_LIMIT = 25;
const FAILED_JOB_LIMIT = 25;
const AUDIT_EVENT_LIMIT = 20;

type ProfileLookupRow = {
  user_id: string;
  display_name: string;
  role: string;
};

type HealthJobQueryRow = {
  id: string;
  session_id: string;
  created_by: string;
  status: string;
  stage: string;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type AuditQueryRow = {
  created_at: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
};

export type AdminHealthJobRow = {
  id: string;
  sessionId: string;
  createdBy: string;
  createdByName: string;
  status: string;
  stage: string;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  heuristic: "stuck_running" | "stuck_queued" | "failed_recent";
};

export type AdminAuditEventRow = {
  createdAt: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  sessionId: string | null;
  jobId: string | null;
  success: boolean | null;
};

export type AdminHealthSnapshot = {
  generatedAt: string;
  stuckThresholdMinutes: number;
  failedWindowHours: number;
  summary: {
    stuckRunningCount: number;
    stuckQueuedCount: number;
    failedLast24HoursCount: number;
  };
  stuckJobs: AdminHealthJobRow[];
  failedJobs: AdminHealthJobRow[];
  recentAuditEvents: AdminAuditEventRow[];
};

const HEALTH_JOB_COLUMNS =
  "id, session_id, created_by, status, stage, attempt_count, error_message, created_at, updated_at";

const AUDIT_COLUMNS =
  "created_at, actor_id, action, entity_type, entity_id, metadata";

function actorNameFor(
  displayNames: Map<string, string>,
  userId: string,
): string {
  return displayNames.get(userId) ?? userId;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toHealthJobRow(
  row: HealthJobQueryRow,
  displayNames: Map<string, string>,
  heuristic: AdminHealthJobRow["heuristic"],
): AdminHealthJobRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    createdBy: row.created_by,
    createdByName: actorNameFor(displayNames, row.created_by),
    status: row.status,
    stage: row.stage,
    attemptCount: row.attempt_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    heuristic,
  };
}

function toAuditEventRow(
  row: AuditQueryRow,
  displayNames: Map<string, string>,
): AdminAuditEventRow {
  const metadata = row.metadata ?? {};

  return {
    createdAt: row.created_at,
    actorId: row.actor_id,
    actorName: actorNameFor(displayNames, row.actor_id),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    sessionId: toNullableString(metadata.session_id),
    jobId: toNullableString(metadata.job_id),
    success: toNullableBoolean(metadata.success),
  };
}

function sortByOldestActivity(rows: AdminHealthJobRow[]): AdminHealthJobRow[] {
  return [...rows].sort((left, right) => {
    const leftTime =
      left.heuristic === "stuck_queued"
        ? Date.parse(left.createdAt)
        : Date.parse(left.updatedAt);
    const rightTime =
      right.heuristic === "stuck_queued"
        ? Date.parse(right.createdAt)
        : Date.parse(right.updatedAt);

    return leftTime - rightTime;
  });
}

export async function getAdminHealthSnapshot(
  orgId: string,
): Promise<{ data: AdminHealthSnapshot | null; error: string | null }> {
  const db = createServiceClient();
  const now = Date.now();
  const stuckThresholdIso = new Date(
    now - STUCK_JOB_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();
  const failedWindowIso = new Date(
    now - FAILED_JOB_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const [
    profilesResult,
    stuckRunningResult,
    stuckQueuedResult,
    failedJobsResult,
    auditResult,
  ] = await Promise.all([
    db
      .from("profiles")
      .select("user_id, display_name, role")
      .eq("org_id", orgId),
    db
      .from("jobs")
      .select(HEALTH_JOB_COLUMNS)
      .eq("org_id", orgId)
      .eq("status", "running")
      .lt("updated_at", stuckThresholdIso)
      .order("updated_at", { ascending: true })
      .limit(STUCK_JOB_LIMIT),
    db
      .from("jobs")
      .select(HEALTH_JOB_COLUMNS)
      .eq("org_id", orgId)
      .eq("status", "queued")
      .lt("created_at", stuckThresholdIso)
      .order("created_at", { ascending: true })
      .limit(STUCK_JOB_LIMIT),
    db
      .from("jobs")
      .select(HEALTH_JOB_COLUMNS)
      .eq("org_id", orgId)
      .eq("status", "failed")
      .gte("updated_at", failedWindowIso)
      .order("updated_at", { ascending: false })
      .limit(FAILED_JOB_LIMIT),
    db
      .from("audit_log")
      .select(AUDIT_COLUMNS)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(AUDIT_EVENT_LIMIT),
  ]);

  const firstError = [
    profilesResult.error,
    stuckRunningResult.error,
    stuckQueuedResult.error,
    failedJobsResult.error,
    auditResult.error,
  ].find(Boolean);

  if (firstError) {
    return { data: null, error: firstError.message };
  }

  const profileRows = (profilesResult.data ?? []) as ProfileLookupRow[];
  const displayNames = new Map(
    profileRows.map((row) => [row.user_id, row.display_name]),
  );

  const stuckRunning = ((stuckRunningResult.data ?? []) as HealthJobQueryRow[]).map(
    (row) => toHealthJobRow(row, displayNames, "stuck_running"),
  );
  const stuckQueued = ((stuckQueuedResult.data ?? []) as HealthJobQueryRow[]).map(
    (row) => toHealthJobRow(row, displayNames, "stuck_queued"),
  );
  const failedJobs = ((failedJobsResult.data ?? []) as HealthJobQueryRow[]).map(
    (row) => toHealthJobRow(row, displayNames, "failed_recent"),
  );
  const auditEvents = ((auditResult.data ?? []) as AuditQueryRow[]).map((row) =>
    toAuditEventRow(row, displayNames),
  );

  return {
    data: {
      generatedAt: new Date(now).toISOString(),
      stuckThresholdMinutes: STUCK_JOB_THRESHOLD_MINUTES,
      failedWindowHours: FAILED_JOB_WINDOW_HOURS,
      summary: {
        stuckRunningCount: stuckRunning.length,
        stuckQueuedCount: stuckQueued.length,
        failedLast24HoursCount: failedJobs.length,
      },
      stuckJobs: sortByOldestActivity([...stuckRunning, ...stuckQueued]),
      failedJobs,
      recentAuditEvents: auditEvents,
    },
    error: null,
  };
}
