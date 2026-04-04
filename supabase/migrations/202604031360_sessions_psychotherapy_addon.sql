-- PR 4 Unit 3: add psychotherapy add-on state to sessions and invalidate
-- billing scoring runs when that state changes.
--
-- Psychotherapy add-on state is mutable session-level billing metadata.
-- Changes are provenance-invalidating events for any non-invalidated scoring
-- run already attached to the session.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS psychotherapy_addon_present BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS psychotherapy_addon_source TEXT
    CHECK (psychotherapy_addon_source IN ('clinician_entered', 'imported')),
  ADD COLUMN IF NOT EXISTS psychotherapy_addon_changed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_psychotherapy_addon_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.psychotherapy_addon_present IS DISTINCT FROM NEW.psychotherapy_addon_present
     OR OLD.psychotherapy_addon_source IS DISTINCT FROM NEW.psychotherapy_addon_source THEN
    NEW.psychotherapy_addon_changed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_set_psychotherapy_addon_changed_at ON public.sessions;

CREATE TRIGGER trg_sessions_set_psychotherapy_addon_changed_at
  BEFORE UPDATE OF psychotherapy_addon_present, psychotherapy_addon_source
  ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_psychotherapy_addon_changed_at();

CREATE OR REPLACE FUNCTION public.invalidate_em_scoring_on_addon_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_context_id UUID;
BEGIN
  IF OLD.psychotherapy_addon_present IS NOT DISTINCT FROM NEW.psychotherapy_addon_present THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM billing.session_billing_context AS ctx
    WHERE ctx.session_id = NEW.id
      AND ctx.org_id = NEW.org_id
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM billing.em_scoring_run AS run
    WHERE run.session_id = NEW.id
      AND run.org_id = NEW.org_id
      AND run.status <> 'invalidated'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT ctx.id
  INTO v_context_id
  FROM billing.session_billing_context AS ctx
  WHERE ctx.session_id = NEW.id
    AND ctx.org_id = NEW.org_id
  ORDER BY ctx.created_at DESC
  LIMIT 1;

  IF v_context_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO billing.em_scoring_run (
    session_id,
    billing_context_id,
    transcript_id,
    input_hash,
    idempotency_key,
    initiated_by,
    source_event,
    status,
    org_id
  )
  VALUES (
    NEW.id,
    v_context_id,
    NULL,
    NULL, -- nullable per PR 4b; semantically correct, invalidation events have no scoring input
    gen_random_uuid()::text,
    NEW.created_by,
    'addon_state_changed',
    'invalidated',
    NEW.org_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_invalidate_em_scoring_on_addon_change ON public.sessions;

CREATE TRIGGER trg_sessions_invalidate_em_scoring_on_addon_change
  AFTER UPDATE OF psychotherapy_addon_present
  ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_em_scoring_on_addon_change();
