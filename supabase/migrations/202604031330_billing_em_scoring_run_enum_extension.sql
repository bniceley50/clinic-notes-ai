-- PR 4a: extend billing.em_scoring_run enums to support invalidation events
-- Required before psychotherapy add-on invalidation trigger can be implemented

ALTER TABLE billing.em_scoring_run
  DROP CONSTRAINT IF EXISTS em_scoring_run_source_event_check;

ALTER TABLE billing.em_scoring_run
  ADD CONSTRAINT em_scoring_run_source_event_check
  CHECK (source_event IN (
    'clinician_triggered',
    'job_pipeline',
    'retry',
    'reprocess',
    'addon_state_changed'
  ));

ALTER TABLE billing.em_scoring_run
  DROP CONSTRAINT IF EXISTS em_scoring_run_status_check;

ALTER TABLE billing.em_scoring_run
  ADD CONSTRAINT em_scoring_run_status_check
  CHECK (status IN (
    'pending',
    'complete',
    'failed',
    'abstained',
    'partial',
    'invalidated'
  ));
