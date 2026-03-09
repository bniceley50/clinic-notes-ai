-- 00006_consent_and_audit.sql
-- Consent capture + audit log extensions for HIPAA / 42 CFR Part 2.
--
-- Extends the existing append-only audit_log table rather than creating
-- a second audit table. Adds a new session_consents table tied to the
-- existing orgs / sessions / auth.users conventions used by this repo.

-- -- 1. Extend audit_log -----------------------------------------------------

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS vendor TEXT;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS request_id TEXT;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS error_code TEXT;

-- metadata already exists on public.audit_log in 00001_initial_schema.sql.
-- No second metadata column is added here.

-- -- 2. session_consents -----------------------------------------------------

CREATE TABLE public.session_consents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL,
  org_id              UUID NOT NULL REFERENCES public.orgs(id),
  clinician_id        UUID NOT NULL REFERENCES auth.users(id),

  -- General HIPAA consent
  hipaa_consent       BOOLEAN NOT NULL DEFAULT false,
  hipaa_consented_at  TIMESTAMPTZ,

  -- 42 CFR Part 2 consent
  part2_applicable    BOOLEAN NOT NULL DEFAULT false,
  part2_consent       BOOLEAN,
  part2_consented_at  TIMESTAMPTZ,
  part2_patient_name  TEXT,
  part2_purpose       TEXT NOT NULL DEFAULT
    'AI-assisted clinical documentation using transcription and note generation services',
  part2_vendors       TEXT[] NOT NULL DEFAULT ARRAY[
    'OpenAI (Whisper transcription)',
    'Anthropic (Claude note generation)',
    'Supabase (encrypted storage)',
    'Vercel (application hosting)',
    'Upstash (session management)'
  ],
  part2_expiry_date   DATE,

  -- Request metadata
  ip_address          INET,
  user_agent          TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_session_consents_session_org FOREIGN KEY (session_id, org_id)
    REFERENCES public.sessions (id, org_id) ON DELETE CASCADE,
  CONSTRAINT chk_session_consents_hipaa_time CHECK (
    hipaa_consent = false OR hipaa_consented_at IS NOT NULL
  ),
  CONSTRAINT chk_session_consents_part2 CHECK (
    (
      part2_applicable = false
      AND part2_consent IS NULL
      AND part2_consented_at IS NULL
    )
    OR
    (
      part2_applicable = true
      AND part2_consent IS NOT NULL
    )
  )
);

ALTER TABLE public.session_consents ENABLE ROW LEVEL SECURITY;

-- SELECT: clinician can read own consent rows; org admins can read across org.
CREATE POLICY session_consents_select ON public.session_consents
  FOR SELECT TO authenticated
  USING (
    (clinician_id = auth.uid() AND public.is_org_member(org_id))
    OR public.is_org_admin(org_id)
  );

-- INSERT: clinician can record consent only for their own org/session.
CREATE POLICY session_consents_insert ON public.session_consents
  FOR INSERT TO authenticated
  WITH CHECK (
    clinician_id = auth.uid()
    AND public.is_org_member(org_id)
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_consents.session_id
        AND sessions.org_id = session_consents.org_id
        AND sessions.created_by = auth.uid()
    )
  );

CREATE INDEX idx_session_consents_session_id
  ON public.session_consents(session_id);

CREATE INDEX idx_session_consents_org_id
  ON public.session_consents(org_id);

CREATE INDEX idx_session_consents_clinician_id
  ON public.session_consents(clinician_id);
