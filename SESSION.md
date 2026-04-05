# Session Context - Clinic Notes AI
> Last updated: 2026-04-04

## Active Branch
main (security audit sequence complete — start D015 Phase 2/3 from a fresh branch)

## Latest Commits on Main
- 7da8d5f security: wire zod validation into note/session/job routes (Check 06, PR #105)
- 7da8d5f Merge PR #105 — security/check-06-zod-validation
- (prior) security: check 24 AUTH_COOKIE_SECRET entropy validation + dependabot (PR #2)
- (prior) security: close checks 03 12 13 — auth/session boundary and intra-org IDOR (PR #1)
- (prior) security: Check 19 error response hardening — 40 files

## Security Audit Sequence — CLOSED
All six post-vibe-code checklist findings resolved on main:
- Check 19: Error response hardening — error code registry, job serializer, structured logging, raw error.message removed from all API routes and SSE
- Check 03: SetPasswordClient.tsx uses persistSession: false — no Supabase token in localStorage on password reset
- Check 12: Worker route returns 401 for unauthenticated callers (was 403)
- Check 13: createJobAction enforces session ownership before createJob() — intra-org IDOR closed
- Check 24: validateConfig() enforces AUTH_COOKIE_SECRET entropy at startup (64+ hex or 43+ base64url)
- Check 06: Zod schemas wired into generate-note, note update, session create, job create routes and both Server Actions; validateBody() fixed; HTML sanitization on note content

## Deferred — Admin Diagnostics Cleanup (low urgency, no client risk)
- src/app/admin/page.tsx — may still show raw historic exception text for legacy job rows
- src/lib/admin/health.ts — same
- New job failures normalize to JOB_PROCESSOR_ERROR

## Current Milestone
Phase 0 complete. Phase 1 org-scoping refactor is the active architectural gate before second-clinic onboarding.

## Immediate Next Work
D015 Phase 2/3 — style-src nonce coverage
- Phase 1 (186 inline color styles → Tailwind classes) is GONE from fix/style-src-phase2-3 (net diff vs main is empty)
- Start fresh branch from main: git checkout -b fix/style-src-phase2-3-clean
- Phase 2: multi-property and layout styles
- Phase 3: dynamic and conditional styles
- Reference: DECISIONS.md D015

## Known Deferred Items
- D015 Phase 2/3 — style-src nonce coverage (see above)
- Admin diagnostics cleanup (admin/page.tsx, health.ts) — see above
- clinic-notes-ai-dev is disposable only and must not be used as a clean trust anchor for billing verification; it contains stale tenant_id billing artifacts from PR 3 verification
- Billing schema PostgREST exposure: live REST probe on 2026-04-03 returned PGRST106 — dashboard confirmation preferred
- Transcript versioning does not exist — transcripts table has no version identity, billing uses transcript_id + input_hash as provenance placeholder
- BAAs with Anthropic, OpenAI, and Vercel are still outstanding
- DEFAULT_PRACTICE_ID required by config validation but has no meaningful runtime callsite
- Governance gap: AGENTS.md still defines the default gate as pnpm lint && pnpm typecheck && pnpm test
- Governance gap: AGENTS.md still encodes one-change-then-gate cadence
- Governance gap: CLAUDE-patterns.md is still effectively empty

## Billing Workstream State (paused during security audit)
- PR 4 (billing context resolution), PR 4a, PR 4b all merged
- PR 5 (caller-supplied org context fix in service-role helpers) was next before security audit interrupted
- resolve_patient_status_for_em() uses SECURITY DEFINER with locked search_path — intentional, documented
- PR 4a: billing.em_scoring_run supports status = invalidated and source_event = addon_state_changed
- PR 4b: billing.em_scoring_run.input_hash nullable for invalidation events
