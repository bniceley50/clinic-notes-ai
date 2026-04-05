# Architecture Decisions — Clinic Notes AI

This file records architectural decisions and their rationale. Entries are append-only.

---

## D001: Supabase Storage over Filesystem Artifacts

**Date:** 2026-03-03
**Status:** Accepted
**Context:** The predecessor project (ai-session-notes) stored audio, transcripts, and drafts on the local filesystem in `.artifacts/`. This required TTL-based cleanup, purge logic, and made the app stateful on the compute side.
**Decision:** All file artifacts (audio, transcripts, drafts) are stored in Supabase Storage buckets with RLS policies scoped to org membership.
**Consequence:** The app is stateless on the compute side (critical for Vercel). No filesystem cleanup logic needed. Supabase handles retention and access control.

---

## D002: Database Job State over In-Memory Store

**Date:** 2026-03-03
**Status:** Accepted
**Context:** The predecessor project used an in-memory job store plus filesystem `status.json` files. This was fragile across deploys and serverless cold starts.
**Decision:** All job state lives in the `jobs` table in Supabase with status, progress, and stage columns.
**Consequence:** Job state survives deploys and cold starts. Enables multiple serverless instances to read job state. Concurrent job guard uses DB-level constraints instead of file locks.

---

## D003: Multi-Practice Isolation via RLS from Day One

**Date:** 2026-03-03
**Status:** Accepted
**Context:** Target is small clinics (2-5 providers). Data isolation between practices is non-negotiable given PHI sensitivity.
**Decision:** Every table has an `org_id` column. All queries gated by `is_org_member(org_id)` RLS function. No exceptions.
**Consequence:** Data isolation is enforced at the database level, not the application level. Even a bug in application code cannot leak data across practices.

---

## D004: AI Kill Switch from Day One

**Date:** 2026-03-03
**Status:** Accepted
**Context:** AI API calls cost money. Development and testing should not require real API spend.
**Decision:** Two flags: `AI_ENABLE_REAL_APIS` and `AI_ENABLE_STUB_APIS`. Stub mode returns fake data. Both can be on simultaneously (stub takes precedence in tests).
**Consequence:** CI/CD runs without API keys. Developers can work offline. Cost is controlled.

---

## D005: Stack Locked

**Date:** 2026-03-03
**Status:** Accepted
**Decision:** Next.js 15 (App Router), React 19, TypeScript (strict), Supabase, Tailwind CSS + shadcn/ui, Vercel. No Laravel, Flask, Django, or raw Express. If something genuinely requires leaving this stack, it must be raised as a decision gate.

---

## D006: Auth Method — Supabase Email Magic Link

**Date:** 2026-03-03
**Status:** Accepted
**Context:** Auth method was an open decision (magic link vs OAuth vs email+password). Need to lock before Milestone 0 coding starts; choice affects middleware, onboarding flow, and session handling.
**Decision:** Use Supabase Auth email magic link as the only auth method for Milestone 0. No OAuth, SAML, SSO, or email+password.
**Consequence:** Fastest path to working auth. Lower support burden than passwords, fewer moving parts than OAuth. Good enough for internal alpha and early testing.
**Revisit when:** Multi-org rollout starts, external clinics need SSO, or user management/support becomes painful.

---

## D007: Job Execution — DB-Backed State with Controlled Worker

**Date:** 2026-03-03
**Status:** Accepted
**Context:** Need a durable job execution model. Request/response handlers on Vercel are not suitable as durable job processors due to timeouts and cold starts.
**Decision:** Use database-backed job rows as the single source of truth. Execution handled by one controlled worker path. API creates job row; worker claims and processes; stage updates written to DB; UI polls DB-backed status.
**Required behaviors:** Idempotent create/start. Retry with capped attempts. Cancel-requested triggers best-effort stop. One active job per session enforced by DB constraint (partial unique index on `session_id` where `status IN ('queued', 'running')`).
**Idempotency key shape:** `session_id + input_hash + pipeline_version`.
**Consequence:** Job state survives deploys and cold starts. No in-memory state dependency. Concurrent job guard is enforced at the database level.

---

## D008: Data Retention — Soft-Delete Rows, TTL Artifacts Only

**Date:** 2026-03-03
**D008 — Status: Implemented (Milestone B)**
- Soft-delete implemented via deleted_at column on all patient-related tables
- RLS policies filter deleted_at IS NULL on all SELECT policies
- Storage artifact cleanup (audio, transcripts, drafts) deferred to TTL job
  (not yet implemented — scheduled for Milestone C)
- Hard cascade delete (deleteSessionCascade) removed
- Last updated: 2026-03-29
**Consequence:** Patient-related records are always recoverable. Storage costs are controlled by expiring temporary blobs only.

---

## D009: RLS Ownership — Strict Single-Owner Model

**Date:** 2026-03-03
**Status:** Accepted
**Context:** Need to define exact access rules before writing RLS policies. Multi-provider collaboration is deferred.
**Decision:** Strict single-owner model for Milestone 0. Provider: CRUD on own sessions, notes, jobs, transcripts. Admin: read-all within practice, limited write only if explicitly required. Service role: bypass for trusted worker/backend actions only. No shared chart or team access in Milestone 0.
**Rule:** Every patient/session/note/job row must carry an ownership field that maps cleanly to `auth.uid()`. RLS policies must be defined table-by-table before shipping: sessions, notes, jobs, transcripts, audit_log, storage paths.
**Consequence:** No cross-provider data visibility until explicitly designed. Simplifies RLS policy set for Milestone 0.

---

## D010: Prompt Storage — Versioned Files in Repo

**Date:** 2026-03-03
**Status:** Accepted
**Context:** AI note generation uses prompts for each note type (SOAP, DAP, BIRP, etc.). Need to decide where prompts live.
**Decision:** Store prompts as versioned markdown files in the repo (`/prompts/*.md` or `/src/prompts/*`). No DB-managed prompt editor, per-user customization, or runtime prompt admin UI in Milestone 0.
**Consequence:** Prompts are easy to diff, review, and version alongside code. Avoids premature prompt CMS work.
**Revisit when:** Practice-level prompt customization becomes a real requirement.

---

## D011: Audit Scope — Minimum Required Events

**Date:** 2026-03-03
**Status:** Accepted
**Context:** Need to define which events are logged before building the audit infrastructure.
**Decision:** Minimum required audit events: auth sign-in, auth sign-out, job created, job started, job failed, job cancelled, job completed, note created, note edited, export generated, export downloaded/accessed, soft-delete/archive actions. Each event includes: actor ID, timestamp, entity type, entity ID, action, metadata safe for logging.
**Rule:** No raw PHI in audit payloads. Log IDs and action types only.
**Consequence:** Audit table schema can be designed once. Coverage is sufficient for compliance baseline without over-engineering.

---

## D012: PHI Gate — Fake Data Until Checklist Passes

**Date:** 2026-03-03
**Status:** Accepted
**Context:** Plan says "architect for real PHI from day one" but also "fake data only until HIPAA review." Need an explicit gate.
**Decision:** All milestones run in fake-data / sanitized-data mode only until a formal go/no-go checklist is passed. Blocked until checklist passes: real patient data, production clinical usage, unrestricted logs, relaxed debug tooling, non-redacted error traces.
**Checklist must cover:** Environment separation, logging redaction, storage encryption posture, access review, RLS verification, vendor/API BAA review, retention behavior verification, incident response basics.
**Consequence:** No ambiguity about when real data is allowed. Checklist is the single gate.

---

## 2026-03-08: Job Processing Architecture

- CreateJobForm uses client-side fetch to POST /api/jobs
  instead of server action — required to capture job.id
  and render AudioUpload with it

- Trigger route (POST /api/jobs/[id]/trigger) sits 
  between client and processor — keeps JOBS_RUNNER_TOKEN 
  off the client while allowing client to initiate processing

- processJob is fire-and-forget from the client perspective
  — client gets 202 immediately, JobStatusPanel polls 
  for progress

- dev-login page uses NEXT_PUBLIC_ALLOW_DEV_LOGIN to 
  gate access — must be NEXT_PUBLIC_ prefix for client 
  component visibility

## 2026-03-21: EHR Extraction Staleness

- EHR extraction is keyed by `transcript_id` and stored as a durable artifact.

- If transcript content is updated without creating a new transcript row,
  the stored EHR fields may be stale.

- Clinicians can manually use the regenerate action to refresh the fields.

- Automatic staleness detection is deferred until after beta.

## 2026-03-21: practiceId Migration Boundary

- The JWT cookie claim is still named `practiceId` for session continuity.

- The translation layer is [src/lib/auth/claims.ts](/Users/brian/clinic-notes-ai/src/lib/auth/claims.ts).

- Files that still use the raw claim name are intentionally limited to the auth contract layer:
  `src/lib/auth/types.ts`, `src/lib/auth/session.ts`,
  `src/app/api/auth/dev-login/route.ts`,
  `src/app/api/auth/dev-bootstrap/route.ts`,
  and their auth/session tests.

- Full migration requires a coordinated cookie/JWT claim rename.

- No new code should introduce `practiceId` outside the auth contract layer.

## 2026-03-22: SameSite Policy for Magic Link Auth

- The app session cookie must use `SameSite=Lax`.

- `SameSite=Strict` was tried as a hardening measure and broke magic link login flows from email clients.

- Email magic links arrive as cross-site top-level navigations. With `Strict`, the app session cookie set during callback handling does not reliably survive the immediate redirect into the app.

- `Lax` allows the cookie on top-level navigations while still blocking cross-site subresource requests, which is the correct tradeoff for OTP/magic-link auth in this app.

## 2026-03-22: Runtime Pipeline Truth

- The default runtime pipeline is transcript-first.

- Jobs complete after transcription in `src/lib/jobs/processor.ts`.

- Automatic note generation is no longer part of the default job lifecycle.

- Note generation remains available as an optional follow-up action after a transcript exists.

- EHR field extraction is transcript-driven and stored separately in `carelogic_field_extractions`.

## 2026-03-22: Current Job Executor Reality

- Durable job state lives in Postgres, and the claim/lease model is real.

- The executor is still a Vercel route-based synchronous processor, not a separate durable worker service.

- `/api/jobs/[id]/trigger` starts work by calling the app's own `/api/jobs/[id]/process` endpoint over HTTP.

- `/api/jobs/runner` requeues expired running leases, then dispatches queued jobs by calling the app's own `/api/jobs/[id]/process` endpoint over HTTP.

- This is the current runtime truth and should be treated as such in docs and planning until the executor is replaced.

## 2026-03-22: Session Delete Behavior Correction

- Current session deletion behavior is a hard cascade delete, not a soft-delete/archive flow.

- `deleteSessionCascade()` deletes notes, transcripts, storage artifacts, EHR extraction rows, jobs, consent rows, and the session row itself.

- This runtime behavior supersedes earlier retention assumptions in D008 for session deletion.

- Retention and compliance documentation must describe the current hard-delete path honestly until the implementation changes.

- [CORRECTION 2026-03-30] This note is superseded. D008 soft-delete is now the runtime behavior.

- `softDeleteSession()` replaced `deleteSessionCascade()`.

- Patient-related rows are retained with `deleted_at`; storage artifacts remain in place until the Milestone C TTL cleaner exists.

---

## D009b: Session Revocation Failure Policy — Asymmetric Fail Behavior

**Date:** 2026-03-30
**Status:** Accepted (pre-production)
**Context:** JTI revocation uses Upstash Redis. Redis can be unavailable due to
network partition, outage, or misconfiguration. Two failure modes exist:
write-side (logout) and read-side (per-request enforcement).
**Decision:** Asymmetric failure policy:
- Write-side (`revokeSession`): **fails hard**. If the revocation write fails,
  the logout route returns 503 and does not clear the session cookie. Logout
  intent is never silently lost. The user sees a failure and can retry.
- Read-side (`isSessionRevoked`): **fails open**. If the revocation check fails
  during request enforcement, the request is allowed through. A Redis outage
  does not take down the entire authenticated surface.
**Consequence:** During a Redis outage, logout is temporarily unavailable.
Previously-revoked tokens remain blocked (their Redis keys survive the outage).
Tokens revoked during the outage window are not recorded and remain valid until
expiry. This is an accepted pre-production tradeoff.
**Revisit condition:** Before general availability or if a Redis outage
coincides with a known credential compromise event, re-evaluate whether
read-side should also fail closed, with appropriate operational runbook coverage
for the resulting app-wide 401 behavior.

---

## D013: Milestone C Artifact Cleanup — Blob TTL, No Row Hard-Delete in Production

**Date:** 2026-03-30
**Status:** Accepted
**Context:** D008 deferred storage artifact cleanup to a TTL job. Soft-deleted
rows accumulate indefinitely; storage blobs for deleted sessions are never
reclaimed until this cleaner runs.
**Decision:** The TTL cleaner (`cleanupSoftDeletedArtifacts`) removes storage
objects only. It does not hard-delete patient-related rows in production.
Row hard-delete is reserved for the test-only purge path (`purgeTestSoftDeletedData`),
which requires `ALLOW_TEST_PURGE=1` and bypasses the TTL age check.
The cleaner piggybacks on the existing `/api/jobs/runner` cron route as a
non-blocking phase. Failures are logged but do not fail the runner response.
**TTL value:** Controlled by `JOB_TTL_SECONDS` (default 86400 seconds / 24h).
**Consequence:** Production patient rows are never physically destroyed by
automated processes. Storage costs are controlled by expiring blobs after TTL.
Test environments can reclaim both blobs and rows via the guarded purge path.
**Path format:** Storage paths in `jobs` are bucket-relative
(e.g. `org/session/job/recording.webm`). A defensive normalizer strips legacy
prefixed paths (e.g. `audio/org/...`) produced by older stub builders, for
forward compatibility with any dev/test data predating this migration.

---

## D014: Claude Code Governance Pack

**Date:** 2026-03-31
**Status:** Accepted

### Decision
Install module-level `CLAUDE.md` files, `.claude/settings.json` permission
fencing, and a `tools/prompts/` template library.

### Why
- Prevent Claude Code from touching `.env`, secrets, or running destructive commands
- Give Claude focused per-module context instead of loading the full root `CLAUDE.md`
- Canonicalize prompt patterns for audit, review, debug, and scaffold sessions

### Consequences
- Claude Code sessions are now fail-closed on destructive ops by default
- New modules should get a `CLAUDE.md` on creation, not after the fact
- `tools/prompts/` is the canonical home for reusable session prompts

---

## D015 — CSP Hardening: Nonce-Based script-src and Class-Based style-src

Date: 2026-03-31
Status: Accepted

### Context
ZAP security scan (2026-03-31) confirmed that the production CSP in
  src/lib/security/headers.ts explicitly allowed script-src 'unsafe-inline'
  and style-src 'unsafe-inline'. Both were real findings, not scanner noise.

No app-authored inline scripts exist in the codebase. However, Next.js App
Router emits framework-generated inline scripts for hydration and runtime
bootstrapping, so removing 'unsafe-inline' from script-src requires
per-request nonce plumbing — CSP must move from static next.config.ts
headers to request-scoped middleware generation.

### Decision
1. Harden script-src to nonce-based CSP by moving CSP generation out of
   next.config.ts static headers and into per-request middleware.
  2. Remove production style-src 'unsafe-inline' after converting the UI to
     class-based styling for all app-authored components.
  3. Retain a development-only style-src 'unsafe-inline' fallback to avoid
     breaking local Next.js tooling while iterating.

### Consequences
  - Production CSP is now nonce-hardened for scripts and class-based for styles
  - headers.ts will lose production script-src and style-src 'unsafe-inline'
  - next.config.ts static CSP header for script-src will be removed
  - Middleware must generate and attach a fresh nonce on every request
  - The nonce must be passed to the Next.js runtime so framework-generated
    scripts receive it
  - Development CSP still allows inline styles to keep local tooling stable

### Related
- ZAP scan report: 2026-03-31
- src/lib/security/headers.ts
- src/middleware.ts
- next.config.ts

---

## D016: Session TTL Reduced to 4 Hours

**Date:** 2026-03-31
**Status:** Accepted

### Context
Session revocation currently depends on Upstash Redis and fails open on the
read side during a Redis outage (see D009b). The previous 8-hour session TTL
made that accepted outage window longer than necessary for the CBH rollout.

### Decision
Adopt `SESSION_TTL_SECONDS=14400` (4 hours) as the operational default for
local examples, deployment templates, cookie expiry, and Redis revocation TTL.

### Consequences
- The maximum window for a token revoked during a Redis outage is cut in half
  relative to the previous 8-hour setting
- Clinicians may need to re-authenticate during longer workdays
- Revisit after pilot usage data if the shorter TTL creates material workflow
  friction

---

## D-BILLING-1: Billing Schema Is Server-Only, Non-Exposed, and Uses org_id

**Date:** 2026-04-03
**Status:** Accepted

### Decision
- All billing infrastructure lives in the `billing` schema, not `public`
- The `billing` schema is server-only for Phase 1 infrastructure work and must
  not be exposed through PostgREST or the Supabase Data API
- Billing tables, indexes, triggers, and RLS policies use the repo's existing
  `org_id` tenancy vocabulary; do not introduce a parallel `tenant_id`
  convention

### Consequences
- `supabase/config.toml` must keep `billing` out of `[api].schemas`
- Hosted Supabase exposure settings still require manual verification outside
  the repo
- Future billing work must join against `public.orgs(id)` and existing org-based
  helper functions instead of inventing a second tenancy model

---

## D-BILLING-2: Billing Audit Tables Are Append-Only at the DB Layer

**Date:** 2026-04-03
**Status:** Accepted

### Decision
- `billing.em_scoring_run`, `billing.em_model_result`,
  `billing.em_clinician_decision`, and `billing.em_export_ledger` are
  append-only from day one
- Append-only enforcement is implemented in the database with shared mutation-
  blocking triggers plus explicit `REVOKE UPDATE, DELETE, TRUNCATE` statements
  for `service_role`

### Consequences
- Application code must model corrections as new rows, not edits in place
- UI convenience reads should come from derived queries or views, never by
  mutating audit history
- Future migrations must preserve DB-level immutability rather than relying on
  app convention or RLS alone

---

## D-BILLING-3: Billing Context Freezes After First Scoring Reference

**Date:** 2026-04-03
**Status:** Accepted

### Decision
- `billing.session_billing_context` is mutable only until the first
  `billing.em_scoring_run` references it
- Once referenced, that billing-context row is frozen by a DB trigger
- Corrections require a new `session_billing_context` row; existing referenced
  rows are not edited in place

### Consequences
- Future scoring runs must point to the intended billing-context row explicitly
- Schema design must allow multiple context rows over time for a single session
  when corrections are required
- Encounter-scoped billing provenance stays auditable even when coding inputs
  are corrected later


---

## D017: Post-Vibe-Code Security Audit — Findings and Remediations

**Date:** 2026-04-04
**Status:** Closed (all findings remediated on main)

### Context
A systematic security audit was run against the codebase using a 26-check
prompt targeting Next.js/Supabase/Vercel SaaS attack surface. All high-value
findings were remediated across four PRs. One low-urgency item is intentionally
deferred.

### Findings and dispositions

**Check 19 — Raw error text leaking to clients (CRITICAL)**
Multiple API routes and SSE streams forwarded raw Supabase/vendor error strings,
stack traces, and stored job.error_message text to authenticated clients.
Remediation: error code registry (src/lib/errors/codes.ts), job serializer
(serializeJobForClient), structured server-side logging via AsyncLocalStorage-backed
logError(), and scrubbed error responses across all 17 affected routes and
10 client consumers. Write-side processor fix: jobs.error_message now persists
stable JOB_PROCESSOR_ERROR code instead of raw exception text.
PR: Check 19 hardening (40 files, merged main)

**Check 03 — Supabase session persisted to localStorage on password reset**
SetPasswordClient.tsx used persistSession: true, leaving Supabase access/refresh
tokens in localStorage on the password reset flow. Main login correctly used
persistSession: false.
Remediation: persistSession: false in SetPasswordClient.tsx; existing
/api/auth/session exchange retained; redirect ordering confirmed correct.
PR: security hotfix (PR #1, merged main)

**Check 12 — Worker route returned 403 for unauthenticated callers**
/api/jobs/[id]/worker returned 403 Forbidden for missing/invalid bearer token.
Unauthenticated requests must return 401.
Remediation: status code corrected to 401 for missing/invalid auth; 409
conflict path unchanged.
PR: security hotfix (PR #1, merged main)

**Check 13 — Intra-org IDOR in createJobAction**
createJobAction accepted session_id from FormData without verifying ownership.
Insert used service role client, bypassing the RLS jobs_insert policy. A
provider could create a job against a colleague's session within the same org.
Remediation: getMySession(user, sessionId) ownership check added before
createJob() call, matching the pattern already used in /api/jobs/route.ts.
PR: security hotfix (PR #1, merged main)

**Check 24 — No entropy validation on AUTH_COOKIE_SECRET**
requiredString() check passed on any non-empty value including "secret" or
"changeme". No runtime enforcement of the 32-byte minimum documented in
.env.example.
Remediation: validateConfig() now rejects secrets that match neither 64+ char
hex nor 43+ char base64url. Error message includes openssl rand -hex 32.
PR: config hardening (PR #2, merged main)

**Dependabot — No automated dependency monitoring**
No .github/dependabot.yml configured.
Remediation: weekly npm ecosystem monitoring added, major version PRs excluded.
PR: config hardening (PR #2, merged main)

**Check 06 — Dead Zod schemas, no server-side input validation**
Schemas existed in note-validation.ts but were never imported. All 27 route
handlers used manual typeof checks. validateBody() helper leaked Zod issue
details to clients. Note content fields had no HTML sanitization.
Remediation: four new schemas written matching live route contracts
(GenerateNoteRouteSchema, UpdateNoteRouteSchema, CreateSessionSchema,
CreateJobSchema); validateBody() fixed to log issues server-side only;
VALIDATION_ERROR added to error code registry; HTML sanitization transform
added to note content field; schemas wired into 4 routes and 2 Server Actions.
PR: validation hardening (PR #105, security/check-06-zod-validation, merged main)

### Intentionally deferred
src/app/admin/page.tsx and src/lib/admin/health.ts may still render raw
historic exception text for job rows written before the Check 19 fix.
New job failures normalize to JOB_PROCESSOR_ERROR. Admin-only surface,
no client risk. Deferred until admin UX becomes a priority.

### Checks confirmed N/A for this stack
- SQL injection: Supabase parameterized query builder used throughout
- Weak JWT signing secret: Supabase manages its own signing key
- Server running as root: Vercel managed runtime
- Database port exposed: Supabase managed Postgres
- HTTPS enforcement: Vercel enforces TLS (SSL Labs A+ confirmed)
- CVE-2025-29927: Next.js 15.5.14 is above the patched threshold


---

## D015 Status Update — 2026-04-05

**D015 is fully implemented on main. No remaining code work.**

Verified live state:
- script-src: nonce-based per-request CSP via middleware, 'unsafe-inline' absent from production
- style-src: production is 'self' only (class-based), dev retains 'unsafe-inline' for tooling
- CSP generation moved from static next.config.ts headers to request-scoped middleware
- Zero inline style attributes remaining in src/ (style={{, style={, CSS-in-JS all absent)
- Per-request nonce generated via Web Crypto API in middleware.ts, attached to all HTML responses

Phase 1 (186 inline color styles converted to Tailwind classes) was absorbed into main.
fix/style-src-phase2-3 branch has no surviving unique D015 diff and can be deleted.
The D015 finding from the 2026-03-31 ZAP scan is fully closed.
