-- 00009_carelogic_extractions.sql
-- Persist CareLogic field extraction results per transcript.

CREATE TABLE public.carelogic_field_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  org_id UUID NOT NULL REFERENCES public.orgs(id),
  job_id UUID NOT NULL,
  transcript_id UUID NOT NULL REFERENCES public.transcripts(id),
  session_type TEXT NOT NULL,
  fields JSONB NOT NULL,
  generated_by UUID NOT NULL REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_extraction_session
    FOREIGN KEY (session_id, org_id)
    REFERENCES public.sessions(id, org_id) ON DELETE CASCADE,
  CONSTRAINT fk_extraction_job
    FOREIGN KEY (job_id, session_id, org_id)
    REFERENCES public.jobs(id, session_id, org_id),
  CONSTRAINT unique_extraction_per_transcript
    UNIQUE (transcript_id)
);

CREATE INDEX idx_carelogic_extractions_session
  ON public.carelogic_field_extractions (session_id, org_id);

ALTER TABLE public.carelogic_field_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY carelogic_extractions_select ON public.carelogic_field_extractions
  FOR SELECT TO authenticated
  USING (
    generated_by = auth.uid()
    OR public.is_org_member(org_id)
  );

CREATE POLICY carelogic_extractions_insert ON public.carelogic_field_extractions
  FOR INSERT TO authenticated
  WITH CHECK (
    generated_by = auth.uid()
    AND public.is_org_member(org_id)
  );

CREATE POLICY carelogic_extractions_update ON public.carelogic_field_extractions
  FOR UPDATE TO authenticated
  USING (
    generated_by = auth.uid()
    AND public.is_org_member(org_id)
  )
  WITH CHECK (
    generated_by = auth.uid()
    AND public.is_org_member(org_id)
  );
