-- 00008_job_claim_lease.sql
-- Add claim/lease metadata and an atomic claim function for jobs.

ALTER TABLE public.jobs ADD COLUMN claimed_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN lease_expires_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN run_token UUID;

CREATE INDEX idx_jobs_queue_lease
  ON public.jobs (status, lease_expires_at, created_at)
  WHERE status = 'queued';

CREATE OR REPLACE FUNCTION public.claim_job_for_processing(
  p_job_id UUID,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.jobs
  SET
    status = 'running',
    stage = 'transcribing',
    progress = 10,
    attempt_count = attempt_count + 1,
    error_message = NULL,
    claimed_at = now(),
    lease_expires_at = now() + (p_lease_seconds * interval '1 second'),
    run_token = gen_random_uuid(),
    updated_at = now()
  WHERE id = p_job_id
    AND status = 'queued'
    AND (lease_expires_at IS NULL OR lease_expires_at <= now())
  RETURNING *;
END;
$$;
