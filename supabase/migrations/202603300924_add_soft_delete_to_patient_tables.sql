ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at
  ON public.sessions (deleted_at);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at
  ON public.jobs (deleted_at);

ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transcripts_deleted_at
  ON public.transcripts (deleted_at);

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_deleted_at
  ON public.notes (deleted_at);

ALTER TABLE public.session_consents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_session_consents_deleted_at
  ON public.session_consents (deleted_at);

ALTER TABLE public.carelogic_field_extractions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_carelogic_field_extractions_deleted_at
  ON public.carelogic_field_extractions (deleted_at);
