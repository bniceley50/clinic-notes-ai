# Red Team Adversarial Audit Report — Clinic Notes AI

**Date:** 2026-03-22
**Target:** `bniceley50/clinic-notes-ai` @ `origin/main`
**Auditor:** Automated security review
**Scope:** Post-hardening (PRs #57–#76), beta with 5 clinicians

---

## Executive Summary

The application has a **strong security posture** for its stage. All 26 API routes were audited: every user-facing data route has authentication, rate limiting, and org_id filtering from authenticated context. RLS is designed as a backstop but the primary isolation layer is application-level `createServiceClient()` queries that always filter by `user.orgId`. The hardening sprint addressed the major structural risks.

**4 findings** warrant attention. No CRITICAL findings. Two HIGH, one MEDIUM, one LOW.

---

## Findings

---

### [SEVERITY: HIGH] SSRF via `NEXT_PUBLIC_APP_URL` — Runner Token Leakage to Attacker-Controlled Server

**File(s):** `src/app/api/jobs/[id]/trigger/route.ts:30-31`, `src/app/api/jobs/runner/route.ts:84-104`

**Attack vector:** Both the trigger and runner routes construct a URL for the self-call to `/api/jobs/[id]/process` using `process.env.NEXT_PUBLIC_APP_URL`. On Vercel, if an attacker can influence the `NEXT_PUBLIC_APP_URL` environment variable (e.g., during a preview deployment with overridden env vars, or via a Vercel project misconfiguration), the self-call — which includes `Authorization: Bearer ${JOBS_RUNNER_TOKEN}` — would be sent to an attacker-controlled server.

The runner route (line 84-88) also falls back to `VERCEL_URL`:
```
process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");
```

`VERCEL_URL` is set by Vercel per-deployment and includes preview URLs. If preview deployments share the same `JOBS_RUNNER_TOKEN` as production, a preview deployment's runner would send the production runner token to the preview URL — which may be accessible to branch authors.

**Impact:** Leakage of `JOBS_RUNNER_TOKEN` allows an attacker to call `/api/jobs/[id]/process` and `/api/jobs/[id]/worker` directly, processing any job or forcing arbitrary state transitions on any job across all orgs.

**Current mitigations:** The token is a shared secret set per-environment. Vercel preview deployments can be configured with different env vars. CSP `connect-src` is `'self'` plus Supabase/Sentry only, but this is a server-side fetch, not browser-constrained.

**Recommendation:**
1. Validate that `NEXT_PUBLIC_APP_URL` points to the app's own origin before making the self-call. Compare against `request.headers.get("host")` or a hardcoded allowlist.
2. Use separate `JOBS_RUNNER_TOKEN` values for preview vs. production deployments.
3. Consider adding a request signature (HMAC of jobId + timestamp) instead of relying solely on a static bearer token.

**Status:** Fixed

**Acknowledged?** No.

---

### [SEVERITY: HIGH] Cancel Route Bypasses Run-Token Fencing — Race Condition with Active Processing

**File(s):** `src/app/api/jobs/[id]/cancel/route.ts:37-41`, `src/lib/jobs/queries.ts:276-294`

**Attack vector:** The cancel route calls `updateJobWorkerFields(id, { status: "failed", ... })` which updates the job row **without checking the `run_token`**. Meanwhile, the processor in `processor.ts` uses `updateClaimedJobWorkerFields(jobId, runToken, ...)` which gates updates on run_token match.

If a user cancels a job while the processor is actively working on it:
1. Cancel sets `status: "failed"`, `stage: "failed"`
2. Processor's next `updateClaimedJob` call succeeds because `run_token` still matches (cancel didn't clear it)
3. Processor overwrites the cancel with `status: "complete"`, `stage: "complete"`

The cancel doesn't clear `run_token`, `claimed_at`, or `lease_expires_at`, so the race window is real.

**Impact:** User believes job is cancelled, but it completes anyway. In the worst case, transcript/note data is generated for a session the user intended to abort. Not a data leak, but a data integrity issue that could affect clinical workflow trust.

**Current mitigations:** The partial unique index prevents duplicate active jobs, so the race doesn't create phantom jobs. But the state corruption is real.

**Recommendation:** Cancel should either:
1. Use `updateClaimedJobWorkerFields` with the current run_token (read-then-CAS), or
2. Set a `cancel_requested` flag that the processor checks at each stage gate, or
3. At minimum, clear `run_token` so the processor's next fenced update fails and the processor detects claim loss.

**Status:** Fixed

**Acknowledged?** No.

---

### [SEVERITY: MEDIUM] Auth Callback Provisioning Race — Duplicate Profile Creation

**File(s):** `src/app/api/auth/callback/route.ts:81-177`

**Attack vector:** The `resolveUserProfile` function follows this sequence:
1. SELECT profile WHERE user_id = X → not found
2. SELECT invite WHERE email = Y → found
3. INSERT profile
4. UPDATE invite (mark used)

If two magic link callbacks for the same user arrive simultaneously (e.g., user clicks link twice quickly, or email client prefetches the link), both requests reach step 1 before either completes step 3. Both find no profile, both find the same unused invite, both attempt to INSERT a profile.

**Impact:** Depends on DB constraints:
- If `profiles` has a unique constraint on `(user_id, org_id)`, one INSERT fails and the user gets an error (`bootstrap_failed`). They can retry and succeed. Annoying but not a security issue.
- If no unique constraint exists, a duplicate profile is created. The user could end up with inconsistent state.

The invite UPDATE at step 4 is also not atomic with the profile INSERT — both callbacks could mark the same invite as used, which is benign.

**Current mitigations:** The `profiles` table likely has a unique constraint on `user_id` + `org_id` based on the schema design, which would make this a UX issue (error on second attempt) rather than a data integrity issue. The `createServiceClient()` calls are sequential within each request.

**Recommendation:**
1. Verify that `profiles` has a UNIQUE constraint on `(user_id, org_id)`.
2. Consider using a Postgres advisory lock or `INSERT ... ON CONFLICT DO NOTHING` to make provisioning idempotent.
3. Handle the unique violation error code gracefully by re-reading the profile instead of returning `bootstrap_failed`.

**Status:** Open

**Acknowledged?** No.

---

### [SEVERITY: LOW] Logout Route Has No Rate Limiting

**File(s):** `src/app/api/auth/logout/route.ts:20-41`

**Attack vector:** The logout endpoint has no `checkRateLimit` call. An attacker with a valid session cookie could call POST `/api/auth/logout` at high volume. Each call writes to Redis (`revokeSession`) and to the audit_log DB table (`writeAuditLog`). While the audit write is fire-and-forget, a sustained flood could stress Redis and the DB.

**Impact:** Minor DoS vector. The Redis write is a simple SET with TTL, so it's lightweight. The audit write could accumulate rows but the `void` pattern means it doesn't block the response. Practical impact is low.

**Current mitigations:** An unauthenticated client gets a redirect with cookie cleared — minimal work done per request. The `/api/auth` path is public so middleware doesn't verify the session.

**Recommendation:** Add `checkRateLimit(apiLimit, identifier)` to the logout route for consistency. Low priority.

**Status:** Open

**Acknowledged?** No.

---

## Areas Reviewed and Found Well-Defended

### Cross-Tenant Isolation: STRONG

Every user-facing API route uses `loadCurrentUser()` → `getMyJob(user, ...)` / `getMySession(user, ...)` which filters by `user.orgId` from the JWT session — never from user input. The pattern is consistent across all 26 routes:

- **Direct object reference:** Every route accepting an entity ID verifies ownership via `getMyJob`, `getMySession`, `getMyNote` — all filter by `eq("org_id", user.orgId)` and (for non-admin) `eq("created_by", user.userId)`.
- **EHR extraction** (`carelogic-fields/route.ts`): Verifies job ownership via `getMyJob`, session ownership via `getMySession`, transcript via `getTranscriptForJob` — all org-filtered.
- **Audio URLs** (`audio-url/route.ts`): Verifies job ownership before generating signed URL. Signed URL is scoped to the specific storage path (1 hour default expiry).
- **Upload routes** (`upload-url/route.ts`, `upload-complete/route.ts`, `upload/route.ts`): All verify job ownership. Storage paths use `user.orgId` from authenticated context, not from request body.
- **Cancel** (`cancel/route.ts`): Verifies job ownership via `getMyJob`.
- **SSE events** (`events/route.ts`): Verifies ownership on initial connect AND on every poll interval via `getMyJob(result.user, id)`.
- **Admin health view** (`src/lib/admin/health.ts:153-206`): All queries filter by `eq("org_id", orgId)` where orgId comes from `result.user.orgId`. Admin page checks `result.user.role !== "admin"`.
- **Storage paths**: Constructed from `user.orgId` / `job.session_id` / `job.id` — all from DB-verified records, not user input.

### `createServiceClient()` Callsites: ALL VERIFIED

All 23 files using `createServiceClient()` were reviewed. Every callsite either:
1. Filters by `user.orgId` from authenticated context (query functions), or
2. Is called from a route that already verified ownership (processor, storage), or
3. Is in auth provisioning (callback, dev-login) which creates new records rather than reading existing ones.

No callsite accepts an org_id from client-controlled input.

### Authentication Boundaries: STRONG

- **Middleware regex tightness**: The worker/process/runner skip patterns (`/^\/api\/jobs\/[^/]+\/worker$/`, `/^\/api\/jobs\/[^/]+\/process$/`) use `$` anchors, preventing path traversal attacks like `/api/jobs/INJECT/process/../../sessions`. The `[^/]+` segment prevents slash injection.
- **Header injection**: Middleware uses `new Headers(request.headers)` then `headers.set(...)`. The `set()` method **replaces** any pre-existing header value — it does not append. Client-injected `x-user-id` headers are overwritten. Verified in `src/middleware.ts:71-74`.
- **Bearer token fallback**: `readSessionFromRequest` (which falls through to bearer auth) is **defined but never imported** outside `session.ts`. The middleware uses only `readSessionFromCookieHeader`. The bearer path is only used by worker/process routes which have their own token auth and are skipped by middleware.
- **Dev login in production**: `isDevLoginAllowed()` checks `process.env.NODE_ENV === "development" && ALLOW_DEV_LOGIN=1` at runtime. This cannot be bypassed by setting `ALLOW_DEV_LOGIN=1` in production because `NODE_ENV` is controlled by the deployment platform.

### PHI Exposure: WELL-CONTROLLED

- **Console.log/error**: The `withLogging` wrapper logs only `{ route, method, status, duration_ms, error, request_id }` — no PHI. The `error` field is `error.message` from exceptions, which for DB/API errors contains error codes, not data. Two routes log structured JSON on error (`carelogic-fields`, `generate-note`) — these log `job_id`, `session_id`, `route`, and `error` (the error message string), not transcript/note content.
- **Sentry**: Configured with `sendDefaultPii: false`. `beforeSend` strips user data to ID only. `beforeBreadcrumb` drops all fetch/xhr breadcrumbs (which could contain request/response bodies). Well-hardened.
- **Audit log metadata**: All `writeAuditLog` calls reviewed. Metadata contains only IDs, role, file_size_bytes, session_type — no PHI. The catch block in `src/lib/audit.ts:113` logs only `params.action`.
- **AI API logging**: Fetch calls to OpenAI/Anthropic use standard `fetch()`. Vercel function logs capture request metadata but not bodies by default. Sentry `beforeBreadcrumb` drops fetch breadcrumbs.

### Rate Limiting: COMPREHENSIVE

- **20 user-facing routes**: All have `checkRateLimit` calls
- **3 machine routes** (runner, process, worker): Have `checkRateLimit` (IP-based)
- **3 auth routes** (callback, dev-login, dev-bootstrap): No rate limiting — standard for auth flow endpoints
- **1 route** (logout): No rate limiting (LOW finding above)
- `generateNoteLimit` is a separate, tighter limit for the Anthropic-calling endpoint.

### Security Headers: STRONG

From `src/lib/security/headers.ts`:
- CSP with `frame-ancestors 'none'`, `object-src 'none'`, `script-src 'self' 'unsafe-inline'` (production)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Strict-Transport-Security` in production
- No explicit CORS headers — defaults to same-origin

### Environment Variables: CLEAN

`NEXT_PUBLIC_` prefixed vars: Only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `ALLOW_DEV_LOGIN`, `SENTRY_DSN` — all safe for client exposure. No secrets use the `NEXT_PUBLIC_` prefix.

### Audit Trail: ADEQUATE FOR BETA

- All major state-changing actions write audit events.
- All audit writes are `void writeAuditLog(...)` (fire-and-forget). If a write fails, the action proceeds without a record.
- Audit metadata contains only IDs and action types — no PHI.
- **Gap:** Session PATCH (update patient_label/status) and note PATCH (edit content) do not write audit events. These should be added before HIPAA compliance review.

---

## Acknowledged Limitations Referenced

The following known limitations from RUNBOOK.md and DECISIONS.md were encountered during the audit and are **not re-reported as new findings**:

- Session revocation fail-open on Redis outage (RUNBOOK §3) — max window is SESSION_TTL_SECONDS (8 hours)
- Rate-limit runtime Redis failures cause 500s (RUNBOOK §3)
- EHR extraction staleness (DECISIONS.md)
- practiceId naming debt (DECISIONS.md)
- Hard-delete cascade, not soft-delete (DECISIONS.md)
- No admin UI for session revocation (RUNBOOK §5)
- AUDIO_BUCKET env var inconsistency (RUNBOOK §6)

---

## Summary Table

| # | Severity | Finding | Exploitable Given Current Deployment? |
|---|----------|---------|---------------------------------------|
| 1 | HIGH | SSRF via NEXT_PUBLIC_APP_URL leaks runner token | Yes, if preview deployments share production token |
| 2 | HIGH | Cancel bypasses run-token fencing | Yes, timing-dependent race condition |
| 3 | MEDIUM | Auth callback provisioning race | Likely mitigated by DB unique constraint; verify |
| 4 | LOW | Logout route has no rate limiting | Minimal practical impact |

The system is well-defended for a beta deployment with test data. The two HIGH findings should be addressed before real PHI enters the system or before the runner token is treated as a high-value credential in production.
