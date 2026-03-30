# RUNBOOK

This document describes the current operational behavior of Clinic Notes AI as of `origin/main` on March 30, 2026.

This is not an aspirational document. If the app has no procedure, no retry, or no tooling for something, this RUNBOOK says so explicitly.

Operational note:
- The app session cookie uses `SameSite=Lax`. `SameSite=Strict` was tried as a security hardening change and broke magic-link login from email clients because the cookie did not survive the email-to-app navigation. `Lax` is required for the current auth flow.

## 1. Setup and Local Dev

### Clone and install

```bash
git clone https://github.com/bniceley50/clinic-notes-ai.git
cd clinic-notes-ai
pnpm install
```

### Create `.env.local`

Create `.env.local` with the environment variables listed in the next section.

Minimum local development values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_COOKIE_SECRET=
SESSION_TTL_SECONDS=28800
DEFAULT_PRACTICE_ID=
```

If you want real AI behavior locally, also set:

```bash
AI_ENABLE_REAL_APIS=1
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JOBS_RUNNER_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=
```

### Start the app

```bash
pnpm dev
```

Expected healthy result:
- Next.js starts without config errors
- App available at `http://localhost:3000`

Problem result:
- Startup throws `Environment configuration error`
- Startup throws `Redis-backed rate limiting is required in production when AI_ENABLE_REAL_APIS is enabled`
- API routes throw `SUPABASE_SERVICE_ROLE_KEY is required for service-role operations`

### Gate command

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected healthy result:
- `pnpm lint`: exits `0` with existing warnings only
- `pnpm typecheck`: exits `0`
- `pnpm test`: all tests pass except known skipped security integration tests when test Supabase env vars are absent

## 2. Deployment

### Infrastructure

**Hosting:** Vercel. Production deploys automatically from the `main` branch
via Vercel's GitHub integration. No manual `vercel --prod` command is required
or used.

**Production URLs:**
- `https://clinicnotes.ai`
- `https://clinic-notes-ai-git-main-brian-niceleys-projects.vercel.app`

Preview deployments are created automatically for all branches and PRs with
branch-scoped aliases (for example
`clinic-notes-ai-git-<branch>-brian-niceleys-projects.vercel.app`).

**Cron and function settings** are defined in `vercel.json`. Do not adjust
function duration or cron schedule outside that file.

### Supabase environments

| Environment | Project name         | Project ID           | Region    |
|-------------|----------------------|----------------------|-----------|
| Production  | clinic-notes-ai      | kacfxexozjueepauitdb | us-west-2 |
| Dev/Staging | clinic-notes-ai-dev  | qkhfusvmqfmtzoandrtf | us-west-2 |
| Local       | Supabase CLI         | —                    | localhost |

The CLI is linked to the dev project (`supabase link` ref: `qkhfusvmqfmtzoandrtf`).
Run `supabase db push --include-all` to apply migrations to dev.
Run migrations against production via the Supabase dashboard SQL editor or
`supabase db push` with the production project ref.

**Dev environment variable scope:**
The dev project uses a subset of production env vars. Real AI vendor calls
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`), Redis (`UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`), and job runner credentials (`JOBS_RUNNER_TOKEN`,
`CRON_SECRET`) are not wired in the current dev configuration.
Set `AI_ENABLE_STUB_APIS=1` and `AI_ENABLE_REAL_APIS=0` for local dev against
this project. Set `ALLOW_DEV_LOGIN=1` and `NEXT_PUBLIC_ALLOW_DEV_LOGIN=1` to
enable the dev login bypass.

### Deploying a migration

Migrations in `supabase/migrations/` are applied manually. There is no
automatic migration runner on deploy.

Procedure:
1. Apply the migration to local CLI first and verify with `pnpm test`
2. Apply to production via Supabase dashboard SQL editor or `supabase db push`
   targeting the production project
3. Confirm the migration appears in the production migration history

Do not apply migrations directly to production without first verifying locally.

### Environment variable promotion

When adding a new required environment variable:
1. Add it to `.env.local` for local dev
2. Add it to the Vercel project environment variables (production + preview)
3. Document it in section 3 (Environment Variables) of this RUNBOOK
4. If it affects `validateConfig()`, update that function and its tests

### Rolling back a deployment

Vercel retains previous deployment snapshots. To roll back:
1. Open the Vercel dashboard → Deployments
2. Select the last known good deployment
3. Promote it to production

Note: rolling back the app does not roll back a migration. If a migration
must be reverted, write and apply a compensating migration manually.

## 3. Environment Variables

### Required

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL used by browser, SSR, and server clients.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key used by browser upload client and SSR auth client.
- `SUPABASE_SERVICE_ROLE_KEY`: required by trusted server paths that use `createServiceClient()`. This is operationally required even though `validateConfig()` does not enforce it.
- `AUTH_COOKIE_SECRET`: signs and verifies the app session JWT cookie.
- `SESSION_TTL_SECONDS`: session TTL and Redis revocation TTL in seconds.
- `DEFAULT_PRACTICE_ID`: required by `validateConfig()`, but there is no meaningful active runtime callsite in the current app. This is currently validation-required technical debt.

### Conditionally Required (real AI)

- `AI_ENABLE_REAL_APIS`: enables real vendor calls instead of stub behavior.
- `OPENAI_API_KEY`: required for Whisper transcription when real AI is enabled.
- `ANTHROPIC_API_KEY`: required for note generation and EHR field extraction when real AI is enabled.
- `UPSTASH_REDIS_REST_URL`: required together with `UPSTASH_REDIS_REST_TOKEN` in production when real AI is enabled.
- `UPSTASH_REDIS_REST_TOKEN`: required together with `UPSTASH_REDIS_REST_URL` in production when real AI is enabled.

### Operationally Required (background jobs)

- `JOBS_RUNNER_TOKEN`: bearer token required by `/api/jobs/[id]/process` and `/api/jobs/runner`.
- `NEXT_PUBLIC_APP_URL`: required for user-triggered job processing to call back into the deployed app. Without this, `/api/jobs/[id]/trigger` falls back to `http://localhost:3000`.
- `CRON_SECRET`: required if Vercel cron is calling `/api/jobs/runner`.

### Optional

- `ANTHROPIC_MODEL`: overrides the default Anthropic model.
- `AI_ENABLE_STUB_APIS`: forces stub AI behavior.
- `AI_WHISPER_TIMEOUT_MS`: config getter exists, but the current Whisper implementation does not use it.
- `AI_CLAUDE_TIMEOUT_MS`: timeout for the synchronous `/api/generate-note` Anthropic request.
- `JOB_TTL_SECONDS`: blob-retention TTL in seconds for soft-deleted job artifacts. The jobs runner removes audio/transcript/draft objects after this cutoff. Default: `86400` (24 hours).
- `VERCEL_URL`: used by the jobs runner to infer its base URL if `NEXT_PUBLIC_APP_URL` is unset.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: optional header for protected Vercel automation calls.
- `TRANSCRIPT_BUCKET`: overrides transcript bucket name for transcript upload/delete paths.
- `AUDIO_BUCKET`: only used by audio download code. Upload/delete paths still hardcode `audio`, so this override is inconsistent.

### Dev/Test Only

- `ALLOW_DEV_LOGIN`: enables `/api/auth/dev-login` in development only.
- `ALLOW_TEST_PURGE`: enables `purgeTestSoftDeletedData()` in test-only environments. Never set in production.
- `NEXT_PUBLIC_ALLOW_DEV_LOGIN`: shows the `/dev-login` page in development.
- `E2E_AUTH_STUB`: short-circuits dev login into a fixed local session.
- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_ANON_KEY`
- `TEST_SUPABASE_SERVICE_ROLE_KEY`
- `TEST_ORG_A_EMAIL`
- `TEST_ORG_A_PASSWORD`
- `TEST_ORG_B_EMAIL`
- `TEST_ORG_B_PASSWORD`

These `TEST_*` vars are only used by the live Supabase security integration suite.

### URL variable reconciliation

Two URL variables exist and their roles overlap:

- `NEXT_PUBLIC_APP_URL`: used by the jobs runner to construct callback URLs
  into the deployed app (`/api/jobs/[id]/trigger`). Falls back to
  `http://localhost:3000` if unset. **Must be set in production.**
- `VERCEL_URL`: injected automatically by Vercel at build time. Used as a
  fallback base URL in the jobs runner if `NEXT_PUBLIC_APP_URL` is unset.
  Not available at runtime in all contexts.
- `NEXT_PUBLIC_SITE_URL`: **not currently used anywhere in this codebase.**
  If found in a deployment environment, it is a leftover from a prior
  configuration and can be removed.

**Rule:** Set `NEXT_PUBLIC_APP_URL` explicitly in all hosted environments.
Do not rely on `VERCEL_URL` as the primary source. Remove `NEXT_PUBLIC_SITE_URL`
if present.

## 4. Failure Scenarios

### Redis unavailable

#### Boot-time behavior

If `NODE_ENV=production`, `AI_ENABLE_REAL_APIS=1`, and Redis env vars are missing, the rate-limit module throws at import time.

Current behavior:
- Fail-closed at boot for production real-AI routes
- App does not gracefully downgrade those routes

What the operator sees:
- Route import/startup error mentioning missing Upstash env vars

What the user sees:
- Affected route returns 500 because the module cannot initialize

#### Runtime Redis outage

Current behavior:
- Rate limiting does not catch runtime Redis request failures
- `limiter.limit()` throws and the route fails

What the user sees:
- 500-level failure on affected API routes

#### Session revocation behavior

Current behavior:
- Logout write path fails closed
- Request-time revocation enforcement fails open
- `revokeSession()` throws on Redis write failure or unavailable revocation store
- `isSessionRevoked()` returns `false` on Redis read errors

What the user sees:
- Logout returns `503` and the browser cookie is not cleared if revocation write fails
- A request may continue through if Redis is unavailable during the read-side revocation check

### Anthropic fails

Current behavior for `/api/generate-note`:
- No retry
- `503` if real AI is disabled or `ANTHROPIC_API_KEY` is missing
- `502` if Anthropic returns a non-OK HTTP response
- `500` for other unexpected failures

What the user sees:
- Inline red error message in the advanced note-generation UI
- No page reload on failure

Examples:
- `Anthropic note generation is not configured`
- `Note generation is unavailable`
- `Note generation failed`
- Detailed vendor error may be surfaced from `detail`

Current behavior for transcript-only jobs:
- Anthropic is not involved
- No Anthropic audit event is written on transcript-only processing

Current behavior for EHR field extraction:
- Stored EHR fields are returned by default when they already exist for the transcript
- Initial extraction calls Anthropic once, stores the result, and returns `generated_at`
- Explicit regeneration (`?regenerate=true`) calls Anthropic again and overwrites the stored result
- No server-side dedupe exists for overlapping regenerate requests beyond the client-side single-flight guard

What the user sees:
- Existing stored fields load immediately
- During regeneration the panel shows `Extracting EHR-ready fields...`
- If regeneration fails, the panel keeps the last successful fields visible and shows the error alongside them

### Whisper fails

Current behavior:
- Jobs are claimed atomically before work starts
- Transient failures requeue up to a maximum of `3` attempts
- `attempt_count` increments when the claim succeeds
- Permanent failure occurs when `attempt_count >= 3`
- Expired running leases are requeued by the runner
- Terminal failures set `status=failed`, `stage=failed`, and populate `error_message`
- `/api/jobs/[id]/process` still returns `500` for the failed processing request itself

What the user sees:
- On retry attempts, the job panel shows `Retrying transcription...`
- Active retrying jobs show `Retry X of 3`
- On terminal failure, the job panel shows `Transcription failed after 3 attempts`
- The job card displays the `error_message`
- The panel also shows guidance to upload the audio again or contact support if the problem continues

### Stuck job

Current behavior:
- No stuck-job detector exists
- No admin UI exists
- The runner requeues expired `running` leases before dispatching queued work
- There is still no admin/operator tooling for stuck-job discovery

What the user sees:
- Job remains queued or running until an operator intervenes
- Session page keeps polling unless the job recovers or fails terminally

Operator action:
- Use the manual SQL in the Operator Procedures section

## 5. Operator Procedures

### A. Revoke current user session

Supported path today: user logout.

```bash
curl -i -X POST https://<app>/api/auth/logout \
  -H "Cookie: cna_session=<session-jwt>"
```

Expected success output:
- `HTTP/1.1 303 See Other`
- `Location: /login`
- `Set-Cookie: cna_session=...; Max-Age=0`

What it does:
- Clears the local cookie
- Writes `revoked:jti:<jti>` into Redis with TTL=`SESSION_TTL_SECONDS`

If Redis is down:
- Route returns `503`
- Cookie is not cleared
- User must retry logout after Redis recovers

### B. Revoke specific session manually

No app UI or API exists for revoking another user’s session.

Manual Redis write is possible only if you already know the session `jti`.

```bash
curl -X POST "$UPSTASH_REDIS_REST_URL/pipeline" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "[[\"SET\",\"revoked:jti:<JTI>\",\"1\",\"EX\",<SESSION_TTL_SECONDS>]]"
```

Expected success output:

```json
[{"result":"OK"}]
```

If you do not know the `jti`:
- No app procedure exists
- Manual Redis revocation is blocked on JTI discovery

### C. Global revocation

Rotate `AUTH_COOKIE_SECRET`.

Effect:
- Immediately invalidates all existing session cookies
- This revokes everyone, not one user

Example workflow:
1. Generate a new random secret
2. Update `AUTH_COOKIE_SECRET` in the deployment environment
3. Redeploy or restart the app

Expected result:
- Existing sessions fail JWT verification
- Users are forced to log in again

### D. Identify stuck jobs

No stuck-job tooling exists. Use manual SQL in Supabase SQL editor.

```sql
select
  id, session_id, org_id, created_by,
  status, stage, progress, attempt_count,
  error_message, created_at, updated_at
from public.jobs
where
  (status = 'running' and updated_at < now() - interval '15 minutes')
  or
  (status = 'queued' and created_at < now() - interval '15 minutes')
order by updated_at asc nulls last, created_at asc;
```

Expected healthy result:
- zero rows

Problem result:
- one or more rows returned with old timestamps

Important note:
- `15 minutes` is an operator heuristic only
- The code does not define a stuck-job threshold

### E. Cancel a known bad job

Supported path: authenticated org admin or owner hits the cancel endpoint.

```bash
curl -i -X POST https://<app>/api/jobs/<job-id>/cancel \
  -H "Authorization: Bearer <session-jwt>"
```

Expected success output:

```json
{
  "job": {
    "id": "<job-id>",
    "status": "failed"
  }
}
```

Current behavior:
- Sets `status=failed`
- Sets `stage=failed`
- Sets `error_message="Cancelled by user"`
- Writes `job.cancelled` audit event

### F. Check audit log

No audit log UI exists. Use SQL.

```sql
select
  created_at,
  org_id,
  actor_id,
  action,
  entity_type,
  entity_id,
  metadata
from public.audit_log
order by created_at desc
limit 100;
```

Expected healthy result:
- Recent actions appear in descending time order

To inspect one session:

```sql
select
  created_at,
  actor_id,
  action,
  entity_type,
  entity_id,
  metadata
from public.audit_log
where metadata->>'session_id' = '<session-id>'
order by created_at desc;
```

### G. Check EHR extraction for a session

Use SQL in Supabase SQL editor.

```sql
SELECT *
FROM public.carelogic_field_extractions
WHERE session_id = '<session-id>'
ORDER BY generated_at DESC
LIMIT 1;
```

Expected healthy result:
- `0` rows if no EHR extraction has been generated yet
- `1` row with `fields`, `generated_at`, `updated_at`, and `transcript_id` for the latest stored extraction

## 6. Known Limitations

- No admin UI exists for session revocation.
- Jobs retry up to `3` attempts, but there is still no operator UI for retry visibility or control beyond the session page status panel.
- No stuck-job tooling exists.
- No operator UI exists for TTL cleanup visibility, manual re-run, or per-artifact inspection.
- Bucket override support is inconsistent. `TRANSCRIPT_BUCKET` is partly honored; `AUDIO_BUCKET` is not consistently honored.
- JTI discovery for per-session manual revocation has no app procedure.
- `DEFAULT_PRACTICE_ID` is still required by config validation even though it has no meaningful active runtime callsite.
- Rate-limit runtime failures are not gracefully handled; a Redis outage can produce 500s.
- Session revocation is asymmetric on Redis outage: logout fails closed, request-time revocation checks fail open.
- EHR extraction staleness: stored extraction is keyed by transcript. Manual regeneration is available. Automatic staleness detection is deferred until after beta.

## 7. Database

### Immutability triggers

Two `BEFORE UPDATE` triggers enforce field-level immutability on clinical
tables. These are intentional constraints, not bugs. If an UPDATE statement
raises an exception citing one of the fields below, the application code is
attempting to mutate a field that must never change after row creation.

**`trg_notes_freeze_immutable_fields`** on `public.notes`
Frozen fields: `session_id`, `job_id`, `org_id`, `created_by`, `note_type`
Mutable fields: `content`, `status`, `updated_at`, `deleted_at`
Migration: `202603221830_freeze_note_immutable_fields.sql`

**`trg_sessions_freeze_immutable_fields`** on `public.sessions`
Frozen fields: `org_id`, `created_by`, `session_type`
Mutable fields: `status`, `patient_label`, `completed_at`, `updated_at`, `deleted_at`
Migration: `202603300940_freeze_session_immutable_fields.sql`

If you see an exception like:

```text
ERROR: notes.session_id is immutable after creation
ERROR: sessions.session_type is immutable after creation
```

the fix is in the application layer, not the database. Do not drop or
disable these triggers to resolve the error.

### Soft-delete pattern (D008)

All patient-related tables (`sessions`, `jobs`, `notes`, `transcripts`,
`session_consents`, `carelogic_field_extractions`) use a `deleted_at`
column for logical deletion. Hard deletes on these tables are not permitted
by application code.

- RLS SELECT policies filter `deleted_at IS NULL` at the database layer
- Application queries also filter `deleted_at IS NULL` explicitly
- Storage artifacts (audio, transcripts, drafts) are retained after soft-delete
  and are hard-deleted later by the TTL cleanup phase on `/api/jobs/runner`
  once `deleted_at` is older than `JOB_TTL_SECONDS`

See DECISIONS.md D008 for full rationale.

### Schema migrations

Migration files live in `supabase/migrations/`. Filename prefix is a
timestamp in `YYYYMMDDHHmm` format. Migrations are append-only — never
edit an applied migration. Write a compensating migration instead.

## 8. Storage

### Buckets

- `audio`
  - private
  - `50 MiB` bucket limit
  - allowed MIME types: `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/x-wav`
- `transcripts`
  - private
  - `5 MiB` bucket limit
  - allowed MIME types: `text/plain`, `application/json`
- `drafts`
  - private
  - `5 MiB` bucket limit
  - allowed MIME types: `text/plain`, `text/markdown`, `application/json`

### Path patterns

- Audio object key in `audio`: `{orgId}/{sessionId}/{jobId}/recording.<ext>`
- Transcript object key in `transcripts`: `{orgId}/{sessionId}/{jobId}/transcript.txt`
- Draft object key in `drafts`: `{orgId}/{sessionId}/{jobId}/note.md`

### Cleanup behavior

Current behavior:
- Session deletion uses soft-delete only (D008). No rows are physically
  removed by the application delete path.
- Blob cleanup runs automatically on the `/api/jobs/runner` cron route after
  normal job maintenance. It removes audio, transcript, and draft objects for
  soft-deleted jobs older than `JOB_TTL_SECONDS`.
- Production cleanup clears artifact path columns on the soft-deleted `jobs`
  rows after successful blob removal. It does not hard-delete patient rows.
- Stored EHR extraction rows live in `public.carelogic_field_extractions`

Soft-delete cascade on session delete:
All child rows are stamped with the same `deleted_at` timestamp as the
parent session, in this order:
1. `notes`
2. `transcripts`
3. `carelogic_field_extractions`
4. `jobs`
5. `session_consents`
6. `sessions` row

Storage blobs are not touched during this operation.

### Stored EHR extractions

- Table: `public.carelogic_field_extractions`
- One row per transcript via `UNIQUE (transcript_id)`
- Stores:
  - `session_id`
  - `org_id`
  - `job_id`
  - `transcript_id`
  - `session_type`
  - `fields` (`JSONB`)
  - `generated_by`
  - `generated_at`
  - `updated_at`

Cleanup behavior:
- Session cleanup is handled by soft-delete (`deleted_at`) on the extraction row and its parent session.
- Blob cleanup is handled later by the TTL phase on `/api/jobs/runner`; session deletion still does not remove blobs immediately.

### Bucket override caveat

- `TRANSCRIPT_BUCKET` is honored by transcript upload.
- `AUDIO_BUCKET` is only honored by audio download code.
- Audio upload and signed upload hardcode `audio`.

This means bucket override support is inconsistent and should not be treated as a fully supported operational feature.

## 9. Beta Clinician Onboarding

### Send an invite

Current operator path:
1. Log in as an org admin
2. Open `/admin`
3. Use the invite form
4. Enter clinician email
5. Choose role (`provider` or `admin`)
6. Submit

Current behavior:
- App writes an `invites` row
- App calls Supabase Admin `inviteUserByEmail`

### What the clinician sees on first login

- They receive an invite or magic link email
- Auth callback provisions their profile from the invite
- They are redirected into the app
- Their main workflow is sessions, transcript, and structured documentation

If no matching invite exists:
- Auth callback returns `no_invite`
- Login page shows the corresponding error state

### Consent flow requirement

Current behavior:
- Patient consent must be recorded before any AI-assisted job work can begin
- Patient consent must also be recorded before optional note generation is available

What the clinician sees:
- Session page blocks job start until consent is recorded
- Optional note generation stays unavailable without consent

### What to tell clinicians if something breaks

Tell them:
- stop using the current session
- do not assume the job will recover on its own
- contact the operator directly

Current honest operator message:
- This app retries transcription jobs up to 3 times and requeues expired running leases automatically
- If a transcription fails after 3 attempts, the error shown in the job panel is the real terminal failure state
- If optional note generation fails, the inline error message is the real failure state
