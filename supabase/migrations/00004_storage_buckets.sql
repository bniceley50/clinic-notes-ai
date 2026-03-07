-- 00004_storage_buckets.sql
-- Create storage buckets for job artifacts.
--
-- Bucket layout follows PLAN.md §8:
--   audio/{orgId}/{sessionId}/{jobId}/recording.webm
--   transcripts/{orgId}/{sessionId}/{jobId}/transcript.txt
--   drafts/{orgId}/{sessionId}/{jobId}/note.md
--
-- All buckets are private (no public URLs). Access is through
-- the service role client in API routes, which enforce ownership
-- before proxying reads/writes.
--
-- Storage object RLS is intentionally restrictive: authenticated
-- users can INSERT into paths matching their own org, and SELECT
-- objects they own. UPDATE and DELETE are service-role only.

-- ── Buckets ──────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audio', 'audio', false, 52428800, ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav']),
  ('transcripts', 'transcripts', false, 5242880, ARRAY['text/plain', 'application/json']),
  ('drafts', 'drafts', false, 5242880, ARRAY['text/plain', 'text/markdown', 'application/json']);

-- ── Storage RLS ──────────────────────────────────────────────
-- Supabase Storage uses storage.objects with RLS.
-- Paths encode ownership: {orgId}/{sessionId}/{jobId}/filename
-- The first path segment is the orgId. We verify membership.

-- Audio bucket: authenticated users can upload to their own org path
CREATE POLICY audio_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audio'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY audio_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'audio'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );

-- Transcripts bucket: read-only for authenticated users in the org
CREATE POLICY transcripts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'transcripts'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );

-- Drafts bucket: read-only for authenticated users in the org
CREATE POLICY drafts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'drafts'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );
