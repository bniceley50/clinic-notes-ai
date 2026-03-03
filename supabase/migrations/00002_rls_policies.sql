-- 00002_rls_policies.sql
-- Milestone 0 RLS policies for Clinic Notes AI.
--
-- Posture: deny-by-default. Every table has RLS enabled.
-- Providers operate on their own rows. Admins read across org.
-- Service role (backend) bypasses RLS for worker writes.
--
-- Decisions applied: D003 (org isolation), D009 (strict single-owner),
-- D011 (audit — server-side writes only).

-- ── Tighten helper functions ─────────────────────────────────
-- is_org_member() was created in 00001 as SECURITY DEFINER.
-- Replace with explicit search_path and STABLE marker so the
-- planner can cache results within a statement.

CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND role = 'admin'
  );
$$;

-- ── Enable RLS on all tables ─────────────────────────────────

ALTER TABLE public.orgs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log   ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- 1. orgs
-- ══════════════════════════════════════════════════════════════
-- SELECT: org members only.
-- INSERT/UPDATE/DELETE: denied to authenticated clients.
-- Org creation is a server/admin operation via service role.

CREATE POLICY orgs_select ON public.orgs
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

-- ══════════════════════════════════════════════════════════════
-- 2. profiles
-- ══════════════════════════════════════════════════════════════
-- SELECT: own profile always; admins can read org profiles.
-- INSERT: denied — creation via service role only (avoids
--         bootstrap deadlock where is_org_member requires a
--         profile to already exist).
-- UPDATE: denied for M0. Profile changes (including display_name)
--         go through a server action using service role. This
--         avoids the privilege escalation risk of letting a user
--         UPDATE their own row (could change role or org_id).
-- DELETE: denied for M0.

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_admin(org_id)
  );

-- ══════════════════════════════════════════════════════════════
-- 3. sessions
-- ══════════════════════════════════════════════════════════════
-- SELECT: provider sees own; admin sees org.
-- INSERT: provider creates own sessions.
-- UPDATE: owner only (status changes, patient_label edits).
--         NOTE: This is a broad row update. RLS does not prevent
--         changing org_id or created_by as long as the new values
--         still pass the policy. App/backend must treat those
--         fields as immutable. A trigger-based freeze is deferred.
-- DELETE: denied (soft-delete via status = 'archived').

CREATE POLICY sessions_select ON public.sessions
  FOR SELECT TO authenticated
  USING (
    (created_by = auth.uid() AND public.is_org_member(org_id))
    OR public.is_org_admin(org_id)
  );

CREATE POLICY sessions_insert ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_org_member(org_id)
  );

CREATE POLICY sessions_update ON public.sessions
  FOR UPDATE TO authenticated
  USING  (created_by = auth.uid() AND public.is_org_member(org_id))
  WITH CHECK (created_by = auth.uid() AND public.is_org_member(org_id));

-- ══════════════════════════════════════════════════════════════
-- 4. jobs
-- ══════════════════════════════════════════════════════════════
-- SELECT: provider sees own; admin sees org.
-- INSERT: provider creates own jobs.
-- UPDATE: denied to authenticated clients. Worker/backend updates
--         jobs (status, stage, progress, storage paths) via service
--         role. If client-side cancel is needed later, it should go
--         through a backend action that validates the transition,
--         not a broad row-level UPDATE policy.
-- DELETE: denied.

CREATE POLICY jobs_select ON public.jobs
  FOR SELECT TO authenticated
  USING (
    (created_by = auth.uid() AND public.is_org_member(org_id))
    OR public.is_org_admin(org_id)
  );

CREATE POLICY jobs_insert ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_org_member(org_id)
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = jobs.session_id
        AND sessions.org_id = jobs.org_id
        AND sessions.created_by = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 5. transcripts
-- ══════════════════════════════════════════════════════════════
-- SELECT: provider reads transcripts for own jobs; admin reads org.
-- INSERT/UPDATE/DELETE: denied to authenticated clients.
-- Worker writes transcripts via service role.

CREATE POLICY transcripts_select ON public.transcripts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = transcripts.job_id
        AND jobs.created_by = auth.uid()
    )
    OR public.is_org_admin(org_id)
  );

-- ══════════════════════════════════════════════════════════════
-- 6. notes
-- ══════════════════════════════════════════════════════════════
-- SELECT: provider sees own; admin sees org.
-- INSERT: provider creates own notes.
-- UPDATE: owner only (content edits, status changes).
--         NOTE: Same broad-update caveat as sessions. RLS does not
--         prevent changing org_id, session_id, job_id, or created_by
--         as long as new values pass the policy. App/backend must
--         treat relationship and ownership fields as immutable.
-- DELETE: denied (soft-delete via status = 'archived' later).

CREATE POLICY notes_select ON public.notes
  FOR SELECT TO authenticated
  USING (
    (created_by = auth.uid() AND public.is_org_member(org_id))
    OR public.is_org_admin(org_id)
  );

CREATE POLICY notes_insert ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_org_member(org_id)
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = notes.session_id
        AND sessions.org_id = notes.org_id
        AND sessions.created_by = auth.uid()
    )
  );

CREATE POLICY notes_update ON public.notes
  FOR UPDATE TO authenticated
  USING  (created_by = auth.uid() AND public.is_org_member(org_id))
  WITH CHECK (created_by = auth.uid() AND public.is_org_member(org_id));

-- ══════════════════════════════════════════════════════════════
-- 7. audit_log
-- ══════════════════════════════════════════════════════════════
-- SELECT: admin only for M0. Providers do not query audit_log
--         directly — no UI for it yet.
-- INSERT: denied to authenticated clients. Backend writes audit
--         rows via service role.
-- UPDATE/DELETE: denied (append-only).

CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_org_admin(org_id));
