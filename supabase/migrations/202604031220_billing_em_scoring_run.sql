CREATE TABLE billing.em_scoring_run (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL,
  billing_context_id  UUID NOT NULL REFERENCES billing.session_billing_context(id) ON DELETE RESTRICT,
  transcript_id       UUID REFERENCES public.transcripts(id) ON DELETE RESTRICT,
  input_hash          VARCHAR(128) NOT NULL CHECK (char_length(btrim(input_hash)) BETWEEN 32 AND 128),
  idempotency_key     VARCHAR(128) NOT NULL CHECK (char_length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  initiated_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_event        VARCHAR(32) NOT NULL CHECK (source_event IN ('clinician_triggered', 'job_pipeline', 'retry', 'reprocess')),
  status              VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'complete', 'failed', 'abstained', 'partial')),
  org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  initiated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,

  CONSTRAINT uq_em_scoring_run_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT fk_em_scoring_run_session_org FOREIGN KEY (session_id, org_id)
    REFERENCES public.sessions(id, org_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION billing.check_org_consistency_em_scoring_run()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ctx_org UUID;
  ctx_session UUID;
  transcript_session UUID;
  transcript_org UUID;
  initiated_actor_exists BOOLEAN;
BEGIN
  SELECT org_id, session_id
  INTO ctx_org, ctx_session
  FROM billing.session_billing_context
  WHERE id = NEW.billing_context_id;

  IF ctx_org IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION
      'org_id mismatch on em_scoring_run: run org % does not match billing context org %.',
      NEW.org_id,
      ctx_org;
  END IF;

  IF ctx_session IS DISTINCT FROM NEW.session_id THEN
    RAISE EXCEPTION
      'session_id mismatch on em_scoring_run: run session % does not match billing context session %.',
      NEW.session_id,
      ctx_session;
  END IF;

  IF NEW.transcript_id IS NOT NULL THEN
    SELECT session_id, org_id
    INTO transcript_session, transcript_org
    FROM public.transcripts
    WHERE id = NEW.transcript_id;

    IF transcript_session IS DISTINCT FROM NEW.session_id
       OR transcript_org IS DISTINCT FROM NEW.org_id THEN
      RAISE EXCEPTION
        'transcript_id mismatch on em_scoring_run: transcript must belong to session % in org %.',
        NEW.session_id,
        NEW.org_id;
    END IF;
  END IF;

  IF NEW.source_event = 'clinician_triggered' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE user_id = NEW.initiated_by
        AND org_id = NEW.org_id
    )
    INTO initiated_actor_exists;

    IF initiated_actor_exists = FALSE THEN
      RAISE EXCEPTION
        'initiated_by % must belong to org % for clinician-triggered scoring runs.',
        NEW.initiated_by,
        NEW.org_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_org_consistency_em_scoring_run
  BEFORE INSERT ON billing.em_scoring_run
  FOR EACH ROW
  EXECUTE FUNCTION billing.check_org_consistency_em_scoring_run();

CREATE TRIGGER prevent_update_em_scoring_run
  BEFORE UPDATE ON billing.em_scoring_run
  FOR EACH ROW
  EXECUTE FUNCTION billing.prevent_mutation();

CREATE TRIGGER prevent_delete_em_scoring_run
  BEFORE DELETE ON billing.em_scoring_run
  FOR EACH ROW
  EXECUTE FUNCTION billing.prevent_mutation();

GRANT SELECT, INSERT ON billing.em_scoring_run TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON billing.em_scoring_run FROM service_role;
