CREATE TABLE billing.em_clinician_decision (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL,
  run_id                  UUID NOT NULL REFERENCES billing.em_scoring_run(id) ON DELETE RESTRICT,
  event_type              VARCHAR(16) NOT NULL CHECK (event_type IN ('initial', 'correction', 'reversal')),
  final_cpt_code          VARCHAR(16) NOT NULL CHECK (final_cpt_code IN (
                            '99202', '99203', '99204', '99205',
                            '99212', '99213', '99214', '99215',
                            'manual_only', 'deferred'
                          )),
  accepted_or_overridden  VARCHAR(16) NOT NULL CHECK (accepted_or_overridden IN ('accepted', 'overridden', 'manual')),
  override_reason_code    VARCHAR(40) CHECK (override_reason_code IN (
                            'documentation_incomplete',
                            'clinical_judgment_differs',
                            'psychotherapy_addon_conflict',
                            'crisis_requires_review',
                            'transcript_quality_low',
                            'billing_context_changed',
                            'other_reviewed'
                          )),
  mdm_lock_acknowledged   BOOLEAN NOT NULL DEFAULT FALSE,
  crisis_reviewed         BOOLEAN NOT NULL DEFAULT FALSE,
  clinician_id            UUID NOT NULL,
  org_id                  UUID NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_em_clinician_decision_session_org FOREIGN KEY (session_id, org_id)
    REFERENCES public.sessions(id, org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_em_clinician_decision_clinician_org FOREIGN KEY (clinician_id, org_id)
    REFERENCES public.profiles(user_id, org_id) ON DELETE RESTRICT,
  CONSTRAINT override_requires_reason CHECK (
    accepted_or_overridden != 'overridden' OR override_reason_code IS NOT NULL
  ),
  CONSTRAINT accepted_has_no_reason CHECK (
    accepted_or_overridden != 'accepted' OR override_reason_code IS NULL
  )
);

CREATE OR REPLACE FUNCTION billing.check_org_consistency_em_clinician_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  run_org UUID;
  run_session UUID;
BEGIN
  SELECT org_id, session_id
  INTO run_org, run_session
  FROM billing.em_scoring_run
  WHERE id = NEW.run_id;

  IF run_org IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION
      'org_id mismatch on em_clinician_decision: decision org % does not match run org %.',
      NEW.org_id,
      run_org;
  END IF;

  IF run_session IS DISTINCT FROM NEW.session_id THEN
    RAISE EXCEPTION
      'session_id mismatch on em_clinician_decision: decision session % does not match run session %.',
      NEW.session_id,
      run_session;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_org_consistency_em_clinician_decision
  BEFORE INSERT ON billing.em_clinician_decision
  FOR EACH ROW
  EXECUTE FUNCTION billing.check_org_consistency_em_clinician_decision();

CREATE TRIGGER prevent_update_em_clinician_decision
  BEFORE UPDATE ON billing.em_clinician_decision
  FOR EACH ROW
  EXECUTE FUNCTION billing.prevent_mutation();

CREATE TRIGGER prevent_delete_em_clinician_decision
  BEFORE DELETE ON billing.em_clinician_decision
  FOR EACH ROW
  EXECUTE FUNCTION billing.prevent_mutation();

GRANT SELECT, INSERT ON billing.em_clinician_decision TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON billing.em_clinician_decision FROM service_role;
