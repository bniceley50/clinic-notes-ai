import "server-only";

import { requireAppUser, type AppUser } from "@/lib/auth/loader";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

type PatientStatus = "new" | "established";

type SessionLookupRow = {
  id: string;
  org_id: string;
  created_by: string;
  patient_label: string | null;
  psychotherapy_addon_present: boolean;
  psychotherapy_addon_source: "clinician_entered" | "imported" | null;
  psychotherapy_addon_changed_at: string | null;
  deleted_at: string | null;
};

type ProfileBillingRow = {
  user_id: string;
  org_id: string;
  rendering_provider_npi: string | null;
  billing_group_id: string | null;
};

type BillingContextRow = {
  id: string;
  org_id: string;
  created_at: string;
};

type BillingContextPayload = {
  session_id: string;
  rendering_provider_id: string;
  billing_group_id: string;
  patient_status_for_em: PatientStatus;
  status_source: "system_derived";
  status_basis_code:
    | "prior_visit_same_group_same_specialty"
    | "no_prior_visit_found";
  psychotherapy_addon_present: boolean;
  psychotherapy_addon_source: "clinician_entered" | "imported" | null;
  psychotherapy_addon_changed_at: string | null;
  resolved_at: string;
  org_id: string;
};

const SESSION_COLUMNS = [
  "id",
  "org_id",
  "created_by",
  "patient_label",
  "psychotherapy_addon_present",
  "psychotherapy_addon_source",
  "psychotherapy_addon_changed_at",
  "deleted_at",
].join(", ");

const PROFILE_COLUMNS = [
  "user_id",
  "org_id",
  "rendering_provider_npi",
  "billing_group_id",
].join(", ");

const BILLING_CONTEXT_COLUMNS = [
  "id",
  "org_id",
  "created_at",
].join(", ");

export class BillingContextAuthError extends Error {
  constructor(message = "Session is not accessible to the authenticated clinician") {
    super(message);
    this.name = "BillingContextAuthError";
  }
}

export class BillingProfileIncompleteError extends Error {
  constructor(message = "Billing profile is incomplete for billing-context resolution") {
    super(message);
    this.name = "BillingProfileIncompleteError";
  }
}

export class BillingContextResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingContextResolutionError";
  }
}

// Mirrors the DB trigger contract from PR 4 Unit 3: only real boolean transitions
// should invalidate previously computed scoring runs.
export function shouldInvalidateScoringOnPsychotherapyAddonChange(
  previousValue: boolean,
  nextValue: boolean,
): boolean {
  return previousValue !== nextValue;
}

function resolveStatusBasisCode(
  patientStatus: PatientStatus,
): BillingContextPayload["status_basis_code"] {
  // Nearest current allowlist fit in the billing schema. The underlying heuristic
  // is product-scoped org-level history, not a literal same-specialty CMS proof.
  return patientStatus === "established"
    ? "prior_visit_same_group_same_specialty"
    : "no_prior_visit_found";
}

function buildBillingContextPayload(
  user: AppUser,
  session: SessionLookupRow,
  profile: ProfileBillingRow,
  patientStatus: PatientStatus,
): BillingContextPayload {
  if (!session.patient_label?.trim()) {
    throw new BillingContextResolutionError(
      "Session patient_label is required to resolve billing context",
    );
  }

  if (session.psychotherapy_addon_present && !session.psychotherapy_addon_source) {
    throw new BillingContextResolutionError(
      "psychotherapy_addon_source is required when psychotherapy_addon_present is true",
    );
  }

  if (!profile.rendering_provider_npi && !profile.billing_group_id) {
    throw new BillingProfileIncompleteError();
  }

  return {
    session_id: session.id,
    rendering_provider_id: user.userId,
    billing_group_id: profile.billing_group_id ?? user.orgId,
    patient_status_for_em: patientStatus,
    status_source: "system_derived",
    status_basis_code: resolveStatusBasisCode(patientStatus),
    psychotherapy_addon_present: session.psychotherapy_addon_present,
    psychotherapy_addon_source: session.psychotherapy_addon_present
      ? session.psychotherapy_addon_source
      : null,
    psychotherapy_addon_changed_at: session.psychotherapy_addon_changed_at,
    resolved_at: new Date().toISOString(),
    org_id: user.orgId,
  };
}

async function loadOwnedSession(
  user: AppUser,
  sessionId: string,
): Promise<SessionLookupRow> {
  const authDb = await createServerClient();

  const { data, error } = await authDb
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new BillingContextResolutionError(
      `Failed to load session for billing context: ${error.message}`,
    );
  }

  if (!data) {
    throw new BillingContextAuthError();
  }

  return data as unknown as SessionLookupRow;
}

async function loadProfileBillingMetadata(
  user: AppUser,
): Promise<ProfileBillingRow> {
  const authDb = await createServerClient();

  const { data, error } = await authDb
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.userId)
    .eq("org_id", user.orgId)
    .single();

  if (error || !data) {
    throw new BillingContextResolutionError(
      `Failed to load billing profile metadata: ${error?.message ?? "profile not found"}`,
    );
  }

  return data as unknown as ProfileBillingRow;
}

async function resolvePatientStatus(
  session: SessionLookupRow,
): Promise<PatientStatus> {
  const authDb = await createServerClient();

  const { data, error } = await authDb.rpc("resolve_patient_status_for_em", {
    p_patient_label: session.patient_label,
    p_org_id: session.org_id,
    p_exclude_session_id: session.id,
  });

  if (error) {
    throw new BillingContextResolutionError(
      `Failed to resolve patient status for billing context: ${error.message}`,
    );
  }

  if (data !== "new" && data !== "established") {
    throw new BillingContextResolutionError(
      "Billing patient status RPC returned an invalid value",
    );
  }

  return data as PatientStatus;
}

async function loadLatestBillingContext(
  sessionId: string,
  orgId: string,
): Promise<BillingContextRow | null> {
  const billingDb = createServiceClient().schema("billing");

  const { data, error } = await billingDb
    .from("session_billing_context")
    .select(BILLING_CONTEXT_COLUMNS)
    .eq("session_id", sessionId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new BillingContextResolutionError(
      `Failed to load billing context: ${error.message}`,
    );
  }

  return (data ?? null) as BillingContextRow | null;
}

async function hasScoringRunReference(
  contextId: string,
): Promise<boolean> {
  const billingDb = createServiceClient().schema("billing");

  const { data, error } = await billingDb
    .from("em_scoring_run")
    .select("id")
    .eq("billing_context_id", contextId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new BillingContextResolutionError(
      `Failed to check billing-context run references: ${error.message}`,
    );
  }

  return Boolean(data);
}

async function insertBillingContext(
  payload: BillingContextPayload,
): Promise<string> {
  const billingDb = createServiceClient().schema("billing");

  const { data, error } = await billingDb
    .from("session_billing_context")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw new BillingContextResolutionError(
      `Failed to insert billing context: ${error?.message ?? "no row returned"}`,
    );
  }

  return data.id as string;
}

async function updateBillingContext(
  contextId: string,
  orgId: string,
  payload: BillingContextPayload,
): Promise<string> {
  const billingDb = createServiceClient().schema("billing");

  const { data, error } = await billingDb
    .from("session_billing_context")
    .update(payload)
    .eq("id", contextId)
    .eq("org_id", orgId)
    .select("id")
    .single();

  if (error || !data) {
    throw new BillingContextResolutionError(
      `Failed to update billing context: ${error?.message ?? "no row returned"}`,
    );
  }

  return data.id as string;
}

// Resolves and snapshots billing context for a session.
// Called explicitly when a clinician initiates E&M scoring.
// Never called automatically on session creation.
export async function resolveBillingContext(
  sessionId: string,
): Promise<{ contextId: string; patientStatus: PatientStatus }> {
  const user = await requireAppUser();
  const session = await loadOwnedSession(user, sessionId);
  const profile = await loadProfileBillingMetadata(user);
  const patientStatus = await resolvePatientStatus(session);
  const payload = buildBillingContextPayload(user, session, profile, patientStatus);
  const existingContext = await loadLatestBillingContext(session.id, session.org_id);

  if (!existingContext) {
    const contextId = await insertBillingContext(payload);
    return { contextId, patientStatus };
  }

  const hasReference = await hasScoringRunReference(existingContext.id);
  const contextId = hasReference
    ? await insertBillingContext(payload)
    : await updateBillingContext(existingContext.id, session.org_id, payload);

  return { contextId, patientStatus };
}
