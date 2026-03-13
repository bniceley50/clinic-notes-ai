Diff-Smell Checklist

Run on every PR before merge. No exceptions.
Claude Code runs this in read-only mode. No edits during review.

Prompt Template
Read-only. Review this PR diff against the diff-smell checklist.
Flag any item that fails. Do not edit any files.
Output: PASS / FAIL per checklist item. List all failures with line references.

Security

 Hardcoded secrets, API keys, or credentials present?
 RLS policies bypassed or missing on new tables/routes?
 Auth routes unprotected or improperly guarded?
 Data fields exposed that should not be returned?
 Input validation missing on new endpoints?

Code Quality

 Silent error catches that swallow exceptions?
 console.log or debug artifacts left in?
 Unreviewed dependencies added to package.json?
 Code outside the declared scope touched?

Coverage

 New paths covered by existing or new tests?
 E2E tests still passing after change?

Scope Discipline

 Changes stay within the declared EDIT_OK scope?
 Formatting-only changes mixed with logic changes?
 Files touched that were not listed in the session plan?


Rules

Any FAIL = do not merge. Resolve first.
Security failures block merge unconditionally.
Scope failures require re-scoping and a new PR if the drift is significant.
This checklist lives in the repo. Update it when the workflow changes.