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
