CREATE INDEX idx_billing_session_billing_context_org_session
  ON billing.session_billing_context (org_id, session_id);

CREATE INDEX idx_billing_session_billing_context_rendering_provider
  ON billing.session_billing_context (rendering_provider_id);

CREATE INDEX idx_billing_em_scoring_run_org_session
  ON billing.em_scoring_run (org_id, session_id);

CREATE INDEX idx_billing_em_scoring_run_org_status_initiated_at
  ON billing.em_scoring_run (org_id, status, initiated_at DESC);

CREATE INDEX idx_billing_em_scoring_run_billing_context
  ON billing.em_scoring_run (billing_context_id);

CREATE INDEX idx_billing_em_model_result_run
  ON billing.em_model_result (run_id);

CREATE INDEX idx_billing_em_model_result_org_provider_model
  ON billing.em_model_result (org_id, provider, model_slug);

CREATE INDEX idx_billing_em_clinician_decision_org_session
  ON billing.em_clinician_decision (org_id, session_id);

CREATE INDEX idx_billing_em_clinician_decision_org_submitted_at
  ON billing.em_clinician_decision (org_id, submitted_at DESC);

CREATE INDEX idx_billing_em_clinician_decision_clinician
  ON billing.em_clinician_decision (clinician_id);

CREATE INDEX idx_billing_em_export_ledger_org_started_at
  ON billing.em_export_ledger (org_id, started_at DESC);
