CREATE TABLE billing.session_billing_context (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                      UUID NOT NULL,
  rendering_provider_id           UUID NOT NULL,
  billing_group_id                UUID NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  patient_status_for_em           VARCHAR(16) NOT NULL CHECK (patient_status_for_em IN ('new', 'established')),
  status_source                   VARCHAR(32) NOT NULL CHECK (status_source IN ('system_derived', 'clinician_confirmed', 'imported')),
  status_basis_code               VARCHAR(64) NOT NULL CHECK (status_basis_code IN (
                                    'prior_visit_same_provider',
                                    'prior_visit_same_group_same_specialty',
                                    'no_prior_visit_found',
                                    'clinician_attested',
                                    'imported_from_ehr'
                                  )),
  psychotherapy_addon_present     BOOLEAN NOT NULL DEFAULT FALSE,
  psychotherapy_addon_source      VARCHAR(32) CHECK (psychotherapy_addon_source IN ('clinician_entered', 'imported')),
  psychotherapy_addon_changed_at  TIMESTAMPTZ,
  resolved_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id                          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_session_billing_context_session_org FOREIGN KEY (session_id, org_id)
    REFERENCES public.sessions(id, org_id) ON DELETE RESTRICT,
  CONSTRAINT fk_session_billing_context_rendering_provider_org FOREIGN KEY (rendering_provider_id, org_id)
    REFERENCES public.profiles(user_id, org_id) ON DELETE RESTRICT,
  CONSTRAINT psychotherapy_addon_source_consistent CHECK (
    (psychotherapy_addon_present = FALSE AND psychotherapy_addon_source IS NULL)
    OR (psychotherapy_addon_present = TRUE AND psychotherapy_addon_source IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION billing.freeze_billing_context_if_referenced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass('billing.em_scoring_run') IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM billing.em_scoring_run
    WHERE billing_context_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'billing.session_billing_context row % cannot be modified after a scoring run references it.',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER freeze_billing_context_if_referenced
  BEFORE UPDATE ON billing.session_billing_context
  FOR EACH ROW
  EXECUTE FUNCTION billing.freeze_billing_context_if_referenced();

CREATE TRIGGER set_updated_at_session_billing_context
  BEFORE UPDATE ON billing.session_billing_context
  FOR EACH ROW
  EXECUTE FUNCTION billing.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON billing.session_billing_context TO service_role;
REVOKE DELETE, TRUNCATE ON billing.session_billing_context FROM service_role;
