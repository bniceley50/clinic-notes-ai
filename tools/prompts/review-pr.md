# review-pr.md — PR Diff Security + Quality Review

Use this prompt after opening a PR and before merging. Pairs with the
default Claude Code PR workflow: PR → diff-smell test → merge.

---

## Prompt

Review this PR for Clinic Notes AI. This is a read-only review session.
Do NOT modify any files. Do NOT run git commands that change state.
Ask me questions if anything is ambiguous before proceeding.

**PR context:**
[PASTE PR TITLE AND DESCRIPTION, OR DESCRIBE THE CHANGE]

**Review steps — execute in order:**

1. Run `git diff HEAD~1` (or the relevant base branch) to see all changes
2. Map every modified file to its module: api/, lib/, components/, hooks/
3. For each changed file, apply the checks below

**Security scan — flag any of these as CRITICAL:**
- Hardcoded API keys, tokens, or secrets
- Missing Zod validation on any new input
- `SUPABASE_SERVICE_ROLE_KEY` referenced outside approved lib/ locations
- SQL injection risk in raw queries
- Missing `requireAuth()` on any new protected route
- New env vars read without validation
- `dangerouslySetInnerHTML` usage

**Performance scan — flag as WARNING:**
- Unnecessary re-renders in components
- Missing `useCallback`/`useMemo` on expensive operations
- N+1 query patterns in route handlers
- Missing rate limiting on new mutation routes
- Redis keys created without TTL

**Code quality scan — flag as SUGGESTION:**
- `any` types introduced
- Functions over 50 lines without clear justification
- Components importing directly from lib/
- Hooks that swallow errors silently
- Missing error state in new hooks

**Output format:**
Use exactly this structure:
CRITICAL: [file:line] — [description]
WARNING: [file:line] — [description]
SUGGESTION: [file:line] — [description]
APPROVED: No issues found — safe to merge

Block merge if any CRITICAL items exist.
