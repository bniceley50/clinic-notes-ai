-- Tighten direct client reads of stored CareLogic field extractions.
-- Providers may only read rows they generated; org admins retain read-all.

DROP POLICY IF EXISTS carelogic_extractions_select ON public.carelogic_field_extractions;

CREATE POLICY carelogic_extractions_select ON public.carelogic_field_extractions
  FOR SELECT TO authenticated
  USING (
    generated_by = auth.uid()
    OR public.is_org_admin(org_id)
  );
