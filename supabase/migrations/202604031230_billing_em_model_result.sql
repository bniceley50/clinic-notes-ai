CREATE TABLE billing.em_model_result (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                      UUID NOT NULL REFERENCES billing.em_scoring_run(id) ON DELETE RESTRICT,
  provider                    VARCHAR(64) NOT NULL CHECK (char_length(btrim(provider)) BETWEEN 1 AND 64),
  model_slug                  VARCHAR(128) NOT NULL CHECK (char_length(btrim(model_slug)) BETWEEN 1 AND 128),
  model_version               VARCHAR(64) NOT NULL CHECK (char_length(btrim(model_version)) BETWEEN 1 AND 64),
  rubric_version              VARCHAR(64) NOT NULL CHECK (char_length(btrim(rubric_version)) BETWEEN 1 AND 64),
  prompt_version              VARCHAR(64) NOT NULL CHECK (char_length(btrim(prompt_version)) BETWEEN 1 AND 64),
  attempt_no                  SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  result_status               VARCHAR(24) NOT NULL CHECK (result_status IN ('success', 'failed', 'abstained', 'timeout', 'invalid_response')),
  failure_code                VARCHAR(40) CHECK (failure_code IN (
                                    'vendor_error',
                                    'timeout',
                                    'invalid_response_format',
                                    'transcript_quality_insufficient',
                                    'billing_context_incomplete'
                                  )),
  abstain_reason_code         VARCHAR(40) CHECK (abstain_reason_code IN (
                                    'insufficient_transcript',
                                    'conflicting_signals',
                                    'crisis_detected_manual_required',
                                    'psychotherapy_conflict'
                                  )),
  suggested_cpt_code          VARCHAR(16) CHECK (suggested_cpt_code IN (
                                    '99202', '99203', '99204', '99205',
                                    '99212', '99213', '99214', '99215',
                                    'abstained'
                                  )),
  problem_level               SMALLINT CHECK (problem_level BETWEEN 2 AND 5),
  data_level                  SMALLINT CHECK (data_level BETWEEN 2 AND 5),
  risk_level                  SMALLINT CHECK (risk_level BETWEEN 2 AND 5),
  pathway_used                VARCHAR(16) CHECK (pathway_used IN ('mdm', 'time', 'abstained')),
  confidence_bucket           VARCHAR(16) NOT NULL CHECK (confidence_bucket IN ('high', 'medium', 'low', 'abstained')),
  psychotherapy_lock_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  crisis_flag                 BOOLEAN NOT NULL DEFAULT FALSE,
  org_id                      UUID NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at                TIMESTAMPTZ,

  CONSTRAINT uq_em_model_result_attempt UNIQUE (
    run_id,
    provider,
    model_slug,
    model_version,
    rubric_version,
    prompt_version,
    attempt_no
  ),
  CONSTRAINT abstained_fields_consistent CHECK (
    (suggested_cpt_code = 'abstained') = (pathway_used = 'abstained')
  ),
  CONSTRAINT psychotherapy_lock_requires_mdm CHECK (
    psychotherapy_lock_applied = FALSE OR pathway_used = 'mdm'
  ),
  CONSTRAINT failure_requires_failure_code CHECK (
    result_status != 'failed' OR failure_code IS NOT NULL
  ),
  CONSTRAINT abstained_requires_abstain_reason CHECK (
    result_status != 'abstained' OR abstain_reason_code IS NOT NULL
  )
);

CREATE OR REPLACE FUNCTION billing.check_org_consistency_em_model_result()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  run_org UUID;
BEGIN
  SELECT org_id
  INTO run_org
  FROM billing.em_scoring_run
  WHERE id = NEW.run_id;

  IF run_org IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION
      'org_id mismatch on em_model_result: result org % does not match run org %.',
      NEW.org_id,
      run_org;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_org_consistency_em_model_result
  BEFORE INSERT ON billing.em_model_result
  FOR EACH ROW
  EXECUTE FUNCTION billing.check_org_consistency_em_model_result();

CREATE TRIGGER prevent_update_em_model_result
  BEFORE UPDATE ON billing.em_model_result
  FOR EACH ROW
  EXECUTE FUNCTION billing.prevent_mutation();

CREATE TRIGGER prevent_delete_em_model_result
  BEFORE DELETE ON billing.em_model_result
  FOR EACH ROW
  EXECUTE FUNCTION billing.prevent_mutation();

GRANT SELECT, INSERT ON billing.em_model_result TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON billing.em_model_result FROM service_role;
