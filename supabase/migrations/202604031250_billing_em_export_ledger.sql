CREATE TABLE billing.em_export_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_by  UUID NOT NULL,
  org_id       UUID NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  export_scope VARCHAR(16) NOT NULL CHECK (export_scope IN ('full', 'date_range', 'session', 'clinician')),
  export_format VARCHAR(8) NOT NULL CHECK (export_format IN ('csv', 'json')),
  status       VARCHAR(16) NOT NULL CHECK (status IN ('initiated', 'complete', 'failed')),
  row_count    INTEGER CHECK (row_count >= 0),
  filters_hash VARCHAR(128) CHECK (filters_hash IS NULL OR char_length(btrim(filters_hash)) BETWEEN 32 AND 128),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT fk_em_export_ledger_exported_by_org FOREIGN KEY (exported_by, org_id)
    REFERENCES public.profiles(user_id, org_id) ON DELETE RESTRICT,
  CONSTRAINT complete_requires_row_count CHECK (
    status != 'complete' OR row_count IS NOT NULL
  )
);

CREATE TRIGGER prevent_update_em_export_ledger
  BEFORE UPDATE ON billing.em_export_ledger
  FOR EACH ROW
  EXECUTE FUNCTION billing.prevent_mutation();

CREATE TRIGGER prevent_delete_em_export_ledger
  BEFORE DELETE ON billing.em_export_ledger
  FOR EACH ROW
  EXECUTE FUNCTION billing.prevent_mutation();

GRANT SELECT, INSERT ON billing.em_export_ledger TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON billing.em_export_ledger FROM service_role;
