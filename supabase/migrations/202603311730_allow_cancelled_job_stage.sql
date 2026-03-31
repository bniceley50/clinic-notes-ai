-- Allow "cancelled" as a first-class job stage.
-- This aligns schema constraints with cancellation semantics introduced in API routes.

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS chk_jobs_stage;

ALTER TABLE public.jobs
  ADD CONSTRAINT chk_jobs_stage
  CHECK (stage IN ('queued', 'transcribing', 'drafting', 'exporting', 'complete', 'failed', 'cancelled'));
