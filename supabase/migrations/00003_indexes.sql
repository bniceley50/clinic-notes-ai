-- 00003_indexes.sql
-- Milestone 0 indexes and partial unique constraints.
--
-- NOTE: Primary keys and UNIQUE constraints from 00001 already
-- create implicit indexes. This migration adds only what is
-- needed for query performance and behavioral constraints.

-- ── Behavioral constraints ───────────────────────────────────

-- D007: one active job per session. A session cannot have more
-- than one job in 'queued' or 'running' state simultaneously.
CREATE UNIQUE INDEX idx_jobs_one_active_per_session
  ON public.jobs (session_id)
  WHERE status IN ('queued', 'running');

-- One generated note per job. Prevents duplicate note rows from
-- the same pipeline run. Manual notes (job_id IS NULL) are not
-- constrained — only rows with a non-null job_id are unique.
CREATE UNIQUE INDEX idx_notes_one_per_job
  ON public.notes (job_id)
  WHERE job_id IS NOT NULL;

-- ── Read-path indexes ────────────────────────────────────────

-- Sessions: list by org (admin view) and by owner (provider view).
CREATE INDEX idx_sessions_org_created
  ON public.sessions (org_id, created_at DESC);

CREATE INDEX idx_sessions_owner_created
  ON public.sessions (created_by, created_at DESC);

-- Jobs: list by session (workspace view) and by org (admin view).
CREATE INDEX idx_jobs_session_created
  ON public.jobs (session_id, created_at DESC);

CREATE INDEX idx_jobs_org_created
  ON public.jobs (org_id, created_at DESC);

-- Notes: list by session (workspace view) and by org (admin view).
CREATE INDEX idx_notes_session_created
  ON public.notes (session_id, created_at DESC);

CREATE INDEX idx_notes_org_created
  ON public.notes (org_id, created_at DESC);

-- Transcripts: list by session. The UNIQUE (job_id) from 00001
-- already covers single-transcript lookup by job, so no separate
-- index on job_id is needed.
CREATE INDEX idx_transcripts_session_created
  ON public.transcripts (session_id, created_at DESC);

-- Audit log: list by org (admin dashboard) and entity lookup
-- (drilling into a specific record's history).
CREATE INDEX idx_audit_log_org_created
  ON public.audit_log (org_id, created_at DESC);

CREATE INDEX idx_audit_log_entity
  ON public.audit_log (entity_type, entity_id);
