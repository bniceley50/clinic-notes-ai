ALTER TABLE billing.session_billing_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.em_scoring_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.em_model_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.em_clinician_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.em_export_ledger ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth only. The billing schema remains server-only in this PR because
-- authenticated clients do not get schema usage or table grants.

CREATE POLICY session_billing_context_select ON billing.session_billing_context
  FOR SELECT TO authenticated
  USING (
    public.is_org_admin(billing.session_billing_context.org_id)
    OR (
      billing.session_billing_context.rendering_provider_id = auth.uid()
      AND public.is_org_member(billing.session_billing_context.org_id)
    )
  );

CREATE POLICY em_scoring_run_select ON billing.em_scoring_run
  FOR SELECT TO authenticated
  USING (
    public.is_org_admin(billing.em_scoring_run.org_id)
    OR EXISTS (
      SELECT 1
      FROM billing.session_billing_context AS ctx
      WHERE ctx.id = billing.em_scoring_run.billing_context_id
        AND ctx.rendering_provider_id = auth.uid()
        AND public.is_org_member(billing.em_scoring_run.org_id)
    )
  );

CREATE POLICY em_model_result_select ON billing.em_model_result
  FOR SELECT TO authenticated
  USING (
    public.is_org_admin(billing.em_model_result.org_id)
    OR EXISTS (
      SELECT 1
      FROM billing.em_scoring_run AS run
      JOIN billing.session_billing_context AS ctx
        ON ctx.id = run.billing_context_id
      WHERE run.id = billing.em_model_result.run_id
        AND ctx.rendering_provider_id = auth.uid()
        AND public.is_org_member(billing.em_model_result.org_id)
    )
  );

CREATE POLICY em_clinician_decision_select ON billing.em_clinician_decision
  FOR SELECT TO authenticated
  USING (
    public.is_org_admin(billing.em_clinician_decision.org_id)
    OR (
      billing.em_clinician_decision.clinician_id = auth.uid()
      AND public.is_org_member(billing.em_clinician_decision.org_id)
    )
  );

CREATE POLICY em_clinician_decision_insert_initial ON billing.em_clinician_decision
  FOR INSERT TO authenticated
  WITH CHECK (
    billing.em_clinician_decision.event_type = 'initial'
    AND billing.em_clinician_decision.clinician_id = auth.uid()
    AND public.is_org_member(billing.em_clinician_decision.org_id)
  );

CREATE POLICY em_export_ledger_select ON billing.em_export_ledger
  FOR SELECT TO authenticated
  USING (public.is_org_admin(billing.em_export_ledger.org_id));
