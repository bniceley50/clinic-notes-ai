DROP POLICY IF EXISTS sessions_select ON public.sessions;

CREATE POLICY sessions_select ON public.sessions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (created_by = auth.uid() AND public.is_org_member(org_id))
      OR public.is_org_admin(org_id)
    )
  );

DROP POLICY IF EXISTS jobs_select ON public.jobs;

CREATE POLICY jobs_select ON public.jobs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (created_by = auth.uid() AND public.is_org_member(org_id))
      OR public.is_org_admin(org_id)
    )
  );

DROP POLICY IF EXISTS transcripts_select ON public.transcripts;

CREATE POLICY transcripts_select ON public.transcripts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.jobs
        WHERE jobs.id = transcripts.job_id
          AND jobs.created_by = auth.uid()
      )
      OR public.is_org_admin(org_id)
    )
  );

DROP POLICY IF EXISTS notes_select ON public.notes;

CREATE POLICY notes_select ON public.notes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (created_by = auth.uid() AND public.is_org_member(org_id))
      OR public.is_org_admin(org_id)
    )
  );

DROP POLICY IF EXISTS session_consents_select ON public.session_consents;

CREATE POLICY session_consents_select ON public.session_consents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (clinician_id = auth.uid() AND public.is_org_member(org_id))
      OR public.is_org_admin(org_id)
    )
  );

DROP POLICY IF EXISTS carelogic_extractions_select
  ON public.carelogic_field_extractions;

CREATE POLICY carelogic_extractions_select
  ON public.carelogic_field_extractions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      generated_by = auth.uid()
      OR public.is_org_member(org_id)
    )
  );
