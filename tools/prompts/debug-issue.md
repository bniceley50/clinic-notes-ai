# debug-issue.md — Systematic Bug Diagnosis

Use this prompt when investigating a bug or unexpected behavior in Clinic Notes AI.
Read-only investigation first. No fixes until root cause is confirmed.

---

## Prompt

I need to diagnose a bug in Clinic Notes AI. This is a read-only investigation session.
Do NOT make any changes to files. Do NOT run any state-changing commands.
Ask me questions if you need clarification before proceeding.

**Bug description:**
[DESCRIBE THE BUG HERE — what happened, what was expected, reproduction steps if known]

**Investigation steps — execute in order:**

1. Read the relevant route handler in `src/app/api/`
2. Run `git log --oneline -20` to identify recent changes near the affected area
3. Run `git diff HEAD~5` scoped to the relevant files
4. Read the corresponding lib/ helpers the route depends on
5. Check for Zod validation gaps — does the input get validated before use?
6. Check auth — is `requireAuth()` called correctly?
7. Trace the data flow: request → validation → auth → lib → response
8. Check job pipeline if the bug involves async processing

**Output format:**
- Root cause hypothesis (ranked by likelihood)
- The exact file and line where the failure likely originates
- What you would need to confirm the hypothesis
- Proposed fix (description only — no code changes without EDIT_OK)
