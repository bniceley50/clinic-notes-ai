-- 00007_storage_owner_rls.sql
-- Tighten Storage RLS from org-wide access to clinician-owned access.
--
-- Problem:
--   The original storage policies only checked the orgId in the object path,
--   which allowed any authenticated clinician in the same org to read another
--   clinician's private artifacts directly through the Supabase Storage API.
--
-- Fix:
--   Require the path to resolve to a real job row owned by auth.uid().
--   Path format remains:
--     {orgId}/{sessionId}/{jobId}/{filename}

CREATE OR REPLACE FUNCTION public.storage_object_owned_by_current_user(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  path_parts TEXT[];
  path_org_id UUID;
  path_session_id UUID;
  path_job_id UUID;
BEGIN
  path_parts := storage.foldername(object_name);

  IF COALESCE(array_length(path_parts, 1), 0) <> 3 THEN
    RETURN FALSE;
  END IF;

  BEGIN
    path_org_id := path_parts[1]::uuid;
    path_session_id := path_parts[2]::uuid;
    path_job_id := path_parts[3]::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN FALSE;
  END;

  RETURN EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE jobs.id = path_job_id
      AND jobs.session_id = path_session_id
      AND jobs.org_id = path_org_id
      AND jobs.created_by = auth.uid()
  );
END;
$$;

DROP POLICY IF EXISTS audio_insert ON storage.objects;
DROP POLICY IF EXISTS audio_select ON storage.objects;
DROP POLICY IF EXISTS transcripts_select ON storage.objects;
DROP POLICY IF EXISTS drafts_select ON storage.objects;

CREATE POLICY audio_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audio'
    AND public.storage_object_owned_by_current_user(name)
  );

CREATE POLICY audio_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'audio'
    AND public.storage_object_owned_by_current_user(name)
  );

CREATE POLICY transcripts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'transcripts'
    AND public.storage_object_owned_by_current_user(name)
  );

CREATE POLICY drafts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'drafts'
    AND public.storage_object_owned_by_current_user(name)
  );
