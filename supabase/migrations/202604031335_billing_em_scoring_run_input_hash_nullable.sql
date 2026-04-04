-- PR 4b: allow input_hash to be NULL for invalidation events
-- Invalidation rows have no scoring input, so NULL is semantically correct
-- Sentinel strings are explicitly rejected as a design choice

ALTER TABLE billing.em_scoring_run
  ALTER COLUMN input_hash DROP NOT NULL;
