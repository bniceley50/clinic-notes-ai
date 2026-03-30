# Lessons Log
_Updated by agent after each user correction or validated win. Read at session start._

---
## How to use this file
- Capture both mistakes and validated wins from the current session.
- Before starting work, scan this file and flag only the entries relevant to today's task.
- Use tags when helpful: `[GLOBAL]`, `[AUTH]`, `[SCOPE]`, `[TEST]`, `[TYPES]`, `[CI]`, `[UI]`, `[DATA]`.
- If the same lesson is validated 2+ times or Brian confirms it as permanent, promote it to `CLAUDE-patterns.md`.
- After promotion, append: `[PROMOTED to CLAUDE-patterns.md YYYY-MM-DD]` to the lesson entry.

## Taxonomy
- `[GLOBAL]` applies across repos and is a candidate for the system prompt.
- `[SCOPE]` covers task boundaries, sequence, and avoiding scope creep.
- `[AUTH]` covers auth, sessions, RLS, permissions, and access control.
- `[TEST]` covers gates, mocks, fixtures, and test workflow mistakes.
- `[TYPES]` covers type safety, interface drift, and schema mismatches.
- `[CI]` covers workflow, environment, preview, and deploy issues.
- `[UI]` covers copy, hierarchy, component contracts, and product framing.
- `[DATA]` covers migrations, storage, prompts, transcript/note handling, and data integrity.

### 2026-03-07 - buildStubNote failed on uppercase note types
**Pattern:** resolveSupportedNoteType() matched against lowercase keys 
but callers passed uppercase ('DAP', 'SOAP'). Silent fallback to soap template.
**Rule:** Always normalize string inputs to lowercase at the boundary 
of any key lookup. Never assume call-site casing.
### 2026-03-07 - buildStubNote interface changed, tests written against old signature
**Pattern:** Unit tests written against stub function before reading its 
current type signature. Tests used string arg; function expected TranscriptSeed object.
**Rule:** Always read the current function signature before writing tests 
against it. Never assume a stub interface matches its original spec.
### 2026-03-07 - Supabase CLI tar extraction corrupted project files
**Pattern:** tar -xzf supabase.tar.gz run from repo root extracted 
Supabase CLI README.md and LICENSE over project files.
**Rule:** Always extract CLI tools to a temp directory outside the repo.
Never run tar extraction from inside the project root.
Add supabase.exe, supabase.tar.gz, *.tar.gz to .gitignore immediately 
after any manual download.

## 2026-03-08

- Supabase magic link redirected to localhost because 
  Site URL and Redirect URLs were not set in Supabase 
  Auth -> URL Configuration
  Rule: always set Site URL and Redirect URLs in 
  Supabase before first production deploy

- ALLOW_DEV_LOGIN env var was invisible to client 
  component because it lacked NEXT_PUBLIC_ prefix
  Rule: client components can only read env vars 
  prefixed with NEXT_PUBLIC_

- Email rate limit hit during auth debugging - 
  Supabase free tier limits magic link sends per hour
  Rule: test auth flow once, not repeatedly; use 
  dev-login bypass for iterative testing

## 2026-03-13 - Sentry installed
**What happened:** Added @sentry/nextjs for production error monitoring.
**Root cause:** Audit flagged missing observability as CRITICAL beta blocker.
**Rule going forward:** No user-facing deployment without error monitoring configured.

## 2026-03-13 - Auth and data route tests added
**What happened:** Added test coverage for auth callback/logout/session and PHI-handling upload/CareLogic routes.
**Root cause:** Repo audit flagged zero test coverage on sensitive paths as HIGH.
**Rule going forward:** Any new route handling auth or user data ships with at least happy-path + failure tests.

## 2026-03-14 - Pipeline simplified to transcript-first
**What happened:** Removed automatic note generation from the default job pipeline. Jobs now complete after transcription. Note generation is preserved as an optional action.
**Root cause:** Product feedback from Gillian - clinicians need EHR fields extracted from transcripts, not a separate SOAP note as the primary output.
**Rule going forward:** The default pipeline should be the minimal path that gives clinicians what they need. Additional outputs (notes, exports) are optional extras, not required steps.

## 2026-03-15 - Session delete with cascade
**What happened:** Added hard delete for sessions with full cascade (notes, transcripts, audio, jobs, consents).
**Root cause:** Beta readiness requires clinicians to manage their own data and prevent PII accumulation.
**Rule going forward:** Any delete operation on clinical data must cascade completely - no orphaned PHI.
[CORRECTION 2026-03-29] — This lesson contradicts D008. Hard cascade delete
was replaced with soft-delete pattern. Storage artifacts are retained until
TTL cleanup. Orphaned PHI risk is managed by RLS filtering deleted_at IS NULL,
not by destroying rows. Do not promote this lesson.

## 2026-03-30 - Soft-delete test cleanup needs separate hygiene path
**What happened:** Smoke-test cleanup now uses soft-delete to stay consistent with D008, which means shared test databases will accumulate `deleted_at` rows over time.
**Root cause:** Behavioral consistency with production removed the old hard-delete teardown path.
**Rule going forward:** Milestone C TTL work should include either a test-only purge path for rows already marked `deleted_at IS NOT NULL` or isolated ephemeral test data. Do not reintroduce hard-delete into normal app flows just to keep tests tidy.
