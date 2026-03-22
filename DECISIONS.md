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
**Status:** Accepted
**Context:** Domain rules say "never hard-delete patient-related records" but `JOB_TTL_SECONDS` implies cleanup. Need to clarify what gets purged.
**Decision:** DB rows (sessions, notes, jobs, transcripts, audit logs) are soft-deleted only (archived/expired flags). File artifacts (audio uploads, intermediate files in Supabase Storage) are eligible for hard-delete after TTL. Clinical content rows are never physically deleted by background TTL jobs.
**Open item:** Exact TTL values per artifact type to be defined during Milestone A implementation.
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
