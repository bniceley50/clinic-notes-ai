-- PR 4 Unit 2: resolve patient status for E&M billing context
--
-- PRODUCT-SCOPED HEURISTIC: same patient_label, same org, within 3 years = established
-- NOT specialty-aware, NOT credentialing-aware, NOT CMS-faithful
-- This is a deliberate product simplification.
--
-- SECURITY DEFINER is required here because provider RLS on public.sessions
-- only exposes the caller's own sessions. The product heuristic explicitly
-- needs to look across all providers inside the org.

CREATE OR REPLACE FUNCTION public.resolve_patient_status_for_em(
  p_patient_label TEXT,
  p_org_id UUID,
  p_exclude_session_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_prior_count
  FROM public.sessions AS s
  WHERE s.org_id = p_org_id
    AND s.patient_label = p_patient_label
    AND s.deleted_at IS NULL
    AND s.created_at > NOW() - INTERVAL '3 years'
    AND (p_exclude_session_id IS NULL OR s.id != p_exclude_session_id);

  IF v_prior_count > 0 THEN
    RETURN 'established';
  END IF;

  RETURN 'new';
END;
$$;
