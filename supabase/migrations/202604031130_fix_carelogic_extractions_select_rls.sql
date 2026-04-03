-- Restore least-privilege reads for stored CareLogic field extractions.
-- Soft-delete filtering must not widen access beyond owner-or-admin scope.

DROP POLICY IF EXISTS carelogic_extractions_select
  ON public.carelogic_field_extractions;

CREATE POLICY carelogic_extractions_select
  ON public.carelogic_field_extractions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (generated_by = auth.uid() AND public.is_org_member(org_id))
      OR public.is_org_admin(org_id)
    )
  );
