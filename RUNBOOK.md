# RUNBOOK

This document describes the current operational behavior of Clinic Notes AI as of `origin/main` on March 21, 2026.

This is not an aspirational document. If the app has no procedure, no retry, or no tooling for something, this RUNBOOK says so explicitly.

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

## 2. Environment Variables

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
- `JOB_TTL_SECONDS`: config getter exists, but there is no active runtime callsite.
- `VERCEL_URL`: used by the jobs runner to infer its base URL if `NEXT_PUBLIC_APP_URL` is unset.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: optional header for protected Vercel automation calls.
- `TRANSCRIPT_BUCKET`: overrides transcript bucket name for transcript upload/delete paths.
- `AUDIO_BUCKET`: only used by audio download code. Upload/delete paths still hardcode `audio`, so this override is inconsistent.

### Dev/Test Only

- `ALLOW_DEV_LOGIN`: enables `/api/auth/dev-login` in development only.
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

## 3. Failure Scenarios

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
- Session revocation is fail-open on Redis outage
- `revokeSession()` swallows Redis write failures
- `isSessionRevoked()` returns `false` on Redis errors

What the user sees:
- Logout still clears the browser cookie
- A revoked session may continue to work elsewhere if Redis write/check failed

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

### Whisper fails

Current behavior:
- No retry
- Job is marked `failed`
- Job `stage` becomes `failed`
- `error_message` is populated
- `/api/jobs/[id]/process` returns 500

What the user sees:
- Session job panel shows `Transcription failed`
- The job card displays the `error_message`
- No automatic retry occurs

### Stuck job

Current behavior:
- No stuck-job detector exists
- No admin UI exists
- No auto-recovery exists

What the user sees:
- Job remains queued or running until an operator intervenes
- Session page keeps polling

Operator action:
- Use the manual SQL in the Operator Procedures section

## 4. Operator Procedures

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
- Attempts to write `revoked:jti:<jti>` into Redis with TTL=`SESSION_TTL_SECONDS`

If Redis is down:
- Cookie is still cleared
- Revocation write may silently fail

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

## 5. Known Limitations

- No admin UI exists for session revocation.
- No retry system exists. Jobs fail terminally.
- No stuck-job tooling exists.
- No storage lifecycle/retention policy exists beyond explicit session deletion.
- Bucket override support is inconsistent. `TRANSCRIPT_BUCKET` is partly honored; `AUDIO_BUCKET` is not consistently honored.
- JTI discovery for per-session manual revocation has no app procedure.
- `DEFAULT_PRACTICE_ID` is still required by config validation even though it has no meaningful active runtime callsite.
- Rate-limit runtime failures are not gracefully handled; a Redis outage can produce 500s.
- Session revocation is fail-open when Redis is unavailable.

## 6. Storage

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

- Audio: `audio/{orgId}/{sessionId}/{jobId}/recording.<ext>`
- Transcript: `transcripts/{orgId}/{sessionId}/{jobId}/transcript.txt`
- Draft: `drafts/{orgId}/{sessionId}/{jobId}/note.md`

### Cleanup behavior

Current behavior:
- No automatic retention or expiration
- Artifacts are only deleted when a session is explicitly deleted

Delete order on session delete:
1. delete `notes` rows
2. delete `transcripts` rows
3. delete audio storage objects
4. delete transcript storage objects
5. delete draft storage objects
6. delete `jobs` rows
7. delete `session_consents`
8. delete `sessions` row

### Bucket override caveat

- `TRANSCRIPT_BUCKET` is honored by transcript upload and session-delete transcript cleanup.
- `AUDIO_BUCKET` is only honored by audio download code.
- Audio upload, signed upload, and session-delete audio cleanup hardcode `audio`.

This means bucket override support is inconsistent and should not be treated as a fully supported operational feature.

## 7. Beta Clinician Onboarding

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
- This app does not have automatic retry or stuck-job recovery yet
- If a transcription fails, the error shown in the job panel is the real failure state
- If optional note generation fails, the inline error message is the real failure state
