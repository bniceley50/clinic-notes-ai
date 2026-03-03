-- 00001_initial_schema.sql
-- Milestone 0 initial schema for Clinic Notes AI.
--
-- Decisions applied: D003 (org isolation), D007 (DB-backed jobs),
-- D008 (soft-delete rows), D009 (strict single-owner), D011 (audit).
--
-- NOTE: RLS policies live in 00002_rls_policies.sql.
-- NOTE: Indexes live in 00003_indexes.sql.
-- NOTE: is_org_member() helper is defined after the profiles table
--       because SQL-language functions validate relations at creation.

-- ── 1. orgs ──────────────────────────────────────────────────

CREATE TABLE public.orgs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. profiles ──────────────────────────────────────────────
-- Links Supabase Auth users to orgs. Creation is server/admin
-- only — no client-side self-service INSERT (see 00002 RLS).

CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES public.orgs(id),
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'provider',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_profiles_role CHECK (role IN ('provider', 'admin')),
  CONSTRAINT uq_profiles_user_org UNIQUE (user_id, org_id)
);

-- ── Helper: org membership check ─────────────────────────────
-- Used by RLS policies in 00002. Defined after profiles table
-- because SQL-language functions validate referenced relations
-- at creation time.

CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 3. sessions ──────────────────────────────────────────────
-- UNIQUE (id, org_id) supports composite FK from child tables
-- so jobs/notes/transcripts cannot reference a different org.

CREATE TABLE public.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.orgs(id),
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  patient_label TEXT,
  session_type  TEXT NOT NULL DEFAULT 'general',
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,

  CONSTRAINT chk_sessions_type   CHECK (session_type IN ('intake', 'follow-up', 'general')),
  CONSTRAINT chk_sessions_status CHECK (status IN ('active', 'completed', 'archived')),
  CONSTRAINT uq_sessions_id_org  UNIQUE (id, org_id)
);

-- ── 4. jobs ──────────────────────────────────────────────────
-- Composite FK (session_id, org_id) -> sessions (id, org_id)
-- ensures a job cannot point to a session in a different org.
-- UNIQUE (id, session_id, org_id) lets transcripts and notes
-- lock the full parent chain via composite FK.

CREATE TABLE public.jobs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL,
  org_id                  UUID NOT NULL REFERENCES public.orgs(id),
  created_by              UUID NOT NULL REFERENCES auth.users(id),
  status                  TEXT NOT NULL DEFAULT 'queued',
  progress                INTEGER NOT NULL DEFAULT 0,
  stage                   TEXT NOT NULL DEFAULT 'queued',
  note_type               TEXT NOT NULL DEFAULT 'soap',
  attempt_count           INTEGER NOT NULL DEFAULT 0,
  error_message           TEXT,
  audio_storage_path      TEXT,
  transcript_storage_path TEXT,
  draft_storage_path      TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_jobs_session_org FOREIGN KEY (session_id, org_id)
    REFERENCES public.sessions (id, org_id) ON DELETE CASCADE,
  CONSTRAINT chk_jobs_status       CHECK (status IN ('queued', 'running', 'complete', 'failed', 'cancelled')),
  CONSTRAINT chk_jobs_stage        CHECK (stage IN ('queued', 'transcribing', 'drafting', 'exporting', 'complete', 'failed')),
  CONSTRAINT chk_jobs_note_type    CHECK (note_type IN ('soap', 'dap', 'birp', 'girp', 'intake', 'progress')),
  CONSTRAINT chk_jobs_progress     CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT chk_jobs_attempt      CHECK (attempt_count >= 0),
  CONSTRAINT uq_jobs_id_session_org UNIQUE (id, session_id, org_id)
);

-- ── 5. transcripts ───────────────────────────────────────────
-- Immutable once created. No created_by — ownership is derived
-- from the parent chain: transcript → job → session → created_by.
-- UNIQUE (job_id): one transcript per job in M0 pipeline.
-- Composite FK (job_id, session_id, org_id) -> jobs (id, session_id, org_id)
-- locks the full parent chain: transcript must reference a job that
-- belongs to the same session AND the same org.

CREATE TABLE public.transcripts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL,
  org_id           UUID NOT NULL REFERENCES public.orgs(id),
  job_id           UUID NOT NULL,
  content          TEXT NOT NULL,
  duration_seconds INTEGER,
  word_count       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_transcripts_session_org FOREIGN KEY (session_id, org_id)
    REFERENCES public.sessions (id, org_id) ON DELETE CASCADE,
  CONSTRAINT fk_transcripts_job_session_org FOREIGN KEY (job_id, session_id, org_id)
    REFERENCES public.jobs (id, session_id, org_id),
  CONSTRAINT uq_transcripts_job   UNIQUE (job_id),
  CONSTRAINT chk_transcripts_dur  CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT chk_transcripts_wc   CHECK (word_count IS NULL OR word_count >= 0)
);

-- ── 6. notes ─────────────────────────────────────────────────
-- Composite FK (session_id, org_id) -> sessions (id, org_id)
-- enforces org consistency.
-- Composite FK (job_id, session_id, org_id) -> jobs (id, session_id, org_id)
-- when job_id is non-null, locks the note to the correct job+session+org.
-- Postgres skips composite FK check when any column is NULL, so manual
-- notes (job_id IS NULL) pass through cleanly.

CREATE TABLE public.notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  org_id     UUID NOT NULL REFERENCES public.orgs(id),
  job_id     UUID,
  content    TEXT NOT NULL DEFAULT '',
  note_type  TEXT NOT NULL DEFAULT 'soap',
  status     TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_notes_session_org FOREIGN KEY (session_id, org_id)
    REFERENCES public.sessions (id, org_id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_job_session_org FOREIGN KEY (job_id, session_id, org_id)
    REFERENCES public.jobs (id, session_id, org_id),
  CONSTRAINT chk_notes_note_type CHECK (note_type IN ('soap', 'dap', 'birp', 'girp', 'intake', 'progress')),
  CONSTRAINT chk_notes_status    CHECK (status IN ('draft', 'final', 'archived'))
);

-- ── 7. audit_log ─────────────────────────────────────────────
-- Append-only. No UPDATE or DELETE permitted (see 00002 RLS).
-- No PHI in metadata — log IDs and action types only (D011).

CREATE TABLE public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.orgs(id),
  actor_id    UUID NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
