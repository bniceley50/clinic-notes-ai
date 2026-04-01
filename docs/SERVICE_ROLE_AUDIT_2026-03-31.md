# Service-Role Audit — 2026-03-31

This audit treats code as ground truth and focuses on cross-tenant isolation risk.

## Summary

- `createServiceClient()` is imported in 21 files and used as the default server-side data path in many helpers.
- No confirmed `HIGH` call site was found where a browser-facing route reads or writes tenant data with the service role client and omits the org boundary in the query itself.
- The main architectural risk is that the repo exposes an unscoped RLS-bypass primitive (`createServiceClient()`) broadly enough that future regressions are easy to introduce.
- The first refactor targets should be internal worker/storage helpers that currently trust raw `jobId` or `storagePath` inputs.

## Ranked Findings

| Risk | File / Function | Tables / Buckets | Path Type | Filters Present? | Why it matters |
| --- | --- | --- | --- | --- | --- |
| HIGH | `src/lib/supabase/server.ts` / `createServiceClient()` | All service-role DB and Storage access | Shared infrastructure helper | None | This is the structural footgun. Any new caller gets full RLS bypass unless it remembers to add org scoping manually. |
| MEDIUM | `src/lib/jobs/queries.ts` / `getJobById`, `listQueuedJobs`, `listExpiredRunningLeasedJobs`, `claimJobForProcessing`, `updateJobWorkerFields`, `updateClaimedJobWorkerFields`, `requeueStaleLeasedJob` | `jobs` | Internal worker / cron | No explicit `org_id` filter on the worker-only functions | Safe today because these functions are used by token-gated internal paths, but they are reusable enough to become a cross-tenant leak if imported into user-facing code. |
| MEDIUM | `src/lib/storage/audio.ts` / `finalizeAudioUploadForJob`, `uploadAudioForJob`, `getSignedAudioUrl` | `jobs`, `audio` bucket | User-facing helper behind validated routes | Job update is keyed by `id`; URL signing is keyed by raw `storagePath` | Current routes validate ownership before calling these helpers, but the helpers themselves do not enforce the org boundary. |
| MEDIUM | `src/lib/storage/audio-download.ts` / `downloadAudioForJob` | `audio` bucket | Internal worker | Raw `storagePath` only | Worker processing trusts the job row to supply the right path. A future caller could bypass tenant scoping by passing any valid object path. |
| MEDIUM | `src/lib/storage/cleanup.ts` / `cleanupSoftDeletedArtifacts`, `purgeTestSoftDeletedData` | `jobs`, `sessions`, `notes`, `transcripts`, `carelogic_field_extractions`, `session_consents`, storage buckets | Cron / test-only cleanup | No `org_id` filter | This is an intentional cross-org maintenance path, but it should remain an explicitly documented exception rather than a pattern other code copies. |
| MEDIUM | `src/lib/auth/provisioning.ts` / `readExistingProfile`, `resolveUserProfile` | `profiles`, `invites`, `orgs` | Auth bootstrap | Existing profile lookup uses `user_id`; invite lookup uses `email` | Safe under the current single-org-per-user model, but brittle if multi-org membership or more complex invite semantics are introduced later. |
| LOW | `src/lib/sessions/queries.ts` / `createSession`, `listMySessions`, `getMySession`, `updateMySession`, `getSessionForOrg`, `softDeleteSession` | `sessions` and related patient tables | User-facing server helpers | `org_id` always present; `created_by` added for non-admin reads/writes | Current session access patterns are explicitly org-scoped and are good candidates for the helper shape to standardize elsewhere. |
| LOW | `src/lib/clinical/queries.ts` / transcript, note, and extraction helpers | `transcripts`, `notes`, `carelogic_field_extractions` | User-facing server helpers and trusted worker writes | Reads filter by `org_id`; worker writes take org/job/session context from trusted callers | The reads are currently scoped correctly. The write helpers still depend on trusted inputs, but they are not directly reachable from browser input without earlier validation. |
| LOW | `src/app/api/jobs/route.ts`, `src/app/api/generate-note/route.ts`, `src/app/api/sessions/[sessionId]/consent/route.ts`, `src/app/sessions/[id]/page.tsx`, `src/app/admin/page.tsx`, `src/app/api/admin/invites/route.ts`, `src/lib/admin/health.ts`, `src/lib/auth/loader.ts` | Mixed | User-facing routes/pages | Explicit `org_id` predicates, plus `created_by` where needed | These were the main browser-facing surfaces checked in this pass. They currently enforce tenant boundaries in-query. |
| LOW | `src/app/api/auth/dev-login/route.ts`, `src/app/api/auth/dev-bootstrap/route.ts`, `src/lib/jobs/pipeline.ts`, `src/lib/jobs/storage.ts`, `src/lib/audit.ts` | Mixed | Dev-only, test-only, bootstrap, or write-only infrastructure | Mixed, but not on the production user path | These files should not be the first Phase 1 refactor targets. They still depend on the unscoped service-role helper, so they inherit the architectural footgun. |

## Recommended Refactor Order

1. Introduce an org-scoped service helper layer so user-facing server code stops importing raw `createServiceClient()` directly.
2. Migrate the worker/job helper cluster in `src/lib/jobs/queries.ts` so the public API distinguishes org-scoped calls from explicit global maintenance calls.
3. Wrap storage helpers so signing, download, and job-row mutation require trusted org/session/job context rather than raw `storagePath` or `jobId` alone.
4. Leave explicit exceptions in place for cron cleanup, test purge, and narrowly defined auth/bootstrap flows, but document them as exceptions in `DECISIONS.md`.
5. Add org-isolation tests for the high-value tables and routes: `sessions`, `jobs`, `transcripts`, `notes`, `carelogic_field_extractions`, and consent routes.
