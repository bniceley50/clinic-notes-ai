-- Freeze session ownership and relationship fields after creation.
-- status, patient_label, completed_at, updated_at, and deleted_at
-- remain mutable; org_id, created_by, and session_type do not.

CREATE OR REPLACE FUNCTION public.freeze_session_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'sessions.org_id is immutable after creation';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'sessions.created_by is immutable after creation';
  END IF;

  IF NEW.session_type IS DISTINCT FROM OLD.session_type THEN
    RAISE EXCEPTION 'sessions.session_type is immutable after creation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_freeze_immutable_fields ON public.sessions;

CREATE TRIGGER trg_sessions_freeze_immutable_fields
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.freeze_session_immutable_fields();
