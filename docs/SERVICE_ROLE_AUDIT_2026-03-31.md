# Service-Role Audit — 2026-03-31

This audit treats code as ground truth and focuses on cross-tenant isolation risk.

## Summary

- `createServiceClient()` is imported in 21 files and used as the default server-side data path in many helpers.
- No confirmed `HIGH` call site was found where a browser-facing route reads or writes tenant data with the service role client and omits the org boundary in the query itself.
- The main architectural risk is that the repo exposes an unscoped RLS-bypass primitive (`createServiceClient()`) broadly enough that future regressions are easy to introduce.
- Phase 1 hardening is complete on `main` as of PR `#95`, which resolved all five `MEDIUM` helper targets before multi-org expansion.

## Resolution Status — 2026-04-02

- PR `#95` completed the Phase 1 architectural gate identified in this audit.
- Commit `b1b2f01` split `src/lib/jobs/queries.ts` into explicit `ForOrg` and `Globally` helper families.
- Commit `a768126` scoped `src/lib/storage/audio.ts` by org context and added path-prefix validation for signed audio URLs and upload finalization.
- Commit `7b2ca6d` marked the remaining worker/admin helpers as explicitly global in `src/lib/storage/audio-download.ts`, `src/lib/storage/cleanup.ts`, and `src/lib/auth/provisioning.ts`.
- The remaining open `HIGH` note is the shared `createServiceClient()` footgun itself, not an active browser-facing tenant leak.

## Ranked Findings

| Risk | Status | File / Function | Tables / Buckets | Path Type | Filters Present? | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| HIGH | Open | `src/lib/supabase/server.ts` / `createServiceClient()` | All service-role DB and Storage access | Shared infrastructure helper | None | This is the structural footgun. Any new caller gets full RLS bypass unless it remembers to add org scoping manually. |
| MEDIUM | Resolved in PR `#95` | `src/lib/jobs/queries.ts` / `getGlobalJobById`, `listQueuedJobsGlobally`, `listExpiredRunningLeasedJobsGlobally`, `claimJobForProcessingGlobally`, `updateJobWorkerFieldsForOrg`, `updateClaimedJobWorkerFieldsForOrg`, `requeueStaleLeasedJobForOrg` | `jobs` | Internal worker / cron | Global helpers are explicit; worker mutations now carry `org_id` in-query | This helper cluster is now split into explicit org-scoped and global-maintenance APIs, which makes accidental misuse visible at the import line. |
| MEDIUM | Resolved in PR `#95` | `src/lib/storage/audio.ts` / `createSignedAudioUploadForOrg`, `finalizeJobAudioUploadForOrg`, `getSignedAudioUrlForOrg`, `uploadJobAudioForOrg` | `jobs`, `audio` bucket | User-facing helper behind validated routes | Org context is enforced in helper inputs; storage path must match `orgId/sessionId/jobId/...` | User-facing signed URL and upload helpers now enforce the org boundary directly instead of trusting callers alone. |
| MEDIUM | Resolved in PR `#95` | `src/lib/storage/audio-download.ts` / `downloadAudioBlobGlobally` | `audio` bucket | Internal worker | Explicit global helper | Worker processing still downloads by raw storage path, but the global scope is now deliberate and documented in the API name. |
| MEDIUM | Resolved in PR `#95` | `src/lib/storage/cleanup.ts` / `cleanupSoftDeletedArtifactsGlobally`, `purgeTestSoftDeletedDataGlobally` | `jobs`, `sessions`, `notes`, `transcripts`, `carelogic_field_extractions`, `session_consents`, storage buckets | Cron / test-only cleanup | Explicit global helper | This remains an intentional cross-org maintenance path, but it is now marked as such rather than looking like a reusable neutral helper. |
| MEDIUM | Resolved in PR `#95` | `src/lib/auth/provisioning.ts` / `readExistingProfileGlobally`, `resolveUserProfileGlobally` | `profiles`, `invites`, `orgs` | Auth bootstrap | Explicit global helper | Invite/profile resolution runs before an org-scoped session exists. The global scope is now visible and intentional in the API name. |
| LOW | Unchanged | `src/lib/sessions/queries.ts` / `createSession`, `listMySessions`, `getMySession`, `updateMySession`, `getSessionForOrg`, `softDeleteSession` | `sessions` and related patient tables | User-facing server helpers | `org_id` always present; `created_by` added for non-admin reads/writes | Current session access patterns are explicitly org-scoped and are good candidates for the helper shape to standardize elsewhere. |
| LOW | Unchanged | `src/lib/clinical/queries.ts` / transcript, note, and extraction helpers | `transcripts`, `notes`, `carelogic_field_extractions` | User-facing server helpers and trusted worker writes | Reads filter by `org_id`; worker writes take org/job/session context from trusted callers | The reads are currently scoped correctly. The write helpers still depend on trusted inputs, but they are not directly reachable from browser input without earlier validation. |
| LOW | Unchanged | `src/app/api/jobs/route.ts`, `src/app/api/generate-note/route.ts`, `src/app/api/sessions/[sessionId]/consent/route.ts`, `src/app/sessions/[id]/page.tsx`, `src/app/admin/page.tsx`, `src/app/api/admin/invites/route.ts`, `src/lib/admin/health.ts`, `src/lib/auth/loader.ts` | Mixed | User-facing routes/pages | Explicit `org_id` predicates, plus `created_by` where needed | These were the main browser-facing surfaces checked in this pass. They currently enforce tenant boundaries in-query. |
| LOW | Unchanged | `src/app/api/auth/dev-login/route.ts`, `src/app/api/auth/dev-bootstrap/route.ts`, `src/lib/jobs/pipeline.ts`, `src/lib/jobs/storage.ts`, `src/lib/audit.ts` | Mixed | Dev-only, test-only, bootstrap, or write-only infrastructure | Mixed, but not on the production user path | These were intentionally not first-wave targets. They still depend on the shared service-role primitive, so they inherit the structural footgun. |

## Follow-up Work

1. Reduce raw `createServiceClient()` exposure so future server helpers default into org-scoped wrappers rather than the shared service-role primitive.
2. Add org-isolation tests for the high-value tables and routes: `sessions`, `jobs`, `transcripts`, `notes`, `carelogic_field_extractions`, and consent routes.
3. Continue the planned security hardening queue with CSP `style-src` Phase 2/3 unless an external review changes priority.
