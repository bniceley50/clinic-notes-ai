-- Freeze note ownership and relationship fields after creation.
-- Content/status updates remain allowed; rebinding and type mutation do not.

CREATE OR REPLACE FUNCTION public.freeze_note_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'notes.session_id is immutable after creation';
  END IF;

  IF NEW.job_id IS DISTINCT FROM OLD.job_id THEN
    RAISE EXCEPTION 'notes.job_id is immutable after creation';
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'notes.org_id is immutable after creation';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'notes.created_by is immutable after creation';
  END IF;

  IF NEW.note_type IS DISTINCT FROM OLD.note_type THEN
    RAISE EXCEPTION 'notes.note_type is immutable after creation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notes_freeze_immutable_fields ON public.notes;

CREATE TRIGGER trg_notes_freeze_immutable_fields
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.freeze_note_immutable_fields();
