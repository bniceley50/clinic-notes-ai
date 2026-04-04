-- PR 4 Unit 1: add billing metadata extensions to public.profiles
-- Existing profiles_select RLS already allows providers to read their own row
-- and org admins to read all rows in-org. Authenticated writes remain denied;
-- service-role/server paths are still the only write path.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rendering_provider_npi TEXT,
  ADD COLUMN IF NOT EXISTS billing_group_id UUID REFERENCES public.orgs(id) ON DELETE SET NULL;
