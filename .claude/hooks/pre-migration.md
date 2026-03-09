# pre-migration

- Any SQL containing `DROP`, `DELETE`, `TRUNCATE`, `ALTER COLUMN`, or `ALTER TABLE ... DROP` is destructive.
- Before executing destructive SQL, Brian must provide explicit typed approval in the thread.
- Do not run destructive SQL based on implication, prior context, or a generalized "approved" statement.
- Read-only review of migration files is always allowed.