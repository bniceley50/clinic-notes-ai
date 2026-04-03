# Session Context - Clinic Notes AI
> Last updated: 2026-04-03

## Active Branch
fix/style-src-phase2-3

## Latest Commits
- da739a0 feat: add billing schema infrastructure (PR 3)
- 49fa1e0 fix: tighten carelogic extraction reads (PR 1)

## Current Milestone
Phase 0 complete. Phase 1 org-scoping refactor is the active architectural gate before second-clinic onboarding.

## Immediate Next PR
PR 4 - session_billing_context resolution logic
- rendering provider from profile extensions
- patient new/established 3-year lookback query
- psychotherapy add-on tracking per session
- Prerequisite: billing schema PostgREST exposure verified manually in Supabase dashboard

## Known Deferred Items
- clinic-notes-ai-dev contains stale tenant_id billing artifacts from PR 3 verification - treat as disposable, use fresh target for next billing verification
- Billing schema PostgREST exposure: verify billing is not in exposed schemas list in Supabase dashboard before PR 4 starts (cannot be confirmed from config.toml alone)
- Transcript versioning does not exist - transcripts table has no version identity, billing uses transcript_id + input_hash as provenance placeholder
- BAAs with Anthropic, OpenAI, and Vercel are still outstanding
- DEFAULT_PRACTICE_ID required by config validation but has no meaningful runtime callsite
- Governance gap: AGENTS.md still defines the default gate as pnpm lint && pnpm typecheck && pnpm test, but broad test safety is not provable for every session in this environment
- Governance gap: AGENTS.md still encodes one-change-then-gate cadence, but foundational migration sequences have already required an explicit multi-migration override pattern
- Governance gap: CLAUDE-patterns.md is still effectively empty, so durable repo patterns are not yet being promoted out of ad hoc session prompts and decision logs

## Governance Notes
- AGENTS.md updated this PR: fixed repo root, milestone framing, note behavior; retained soft-delete truth because the prompt's hard-cascade claim conflicts with current code and decisions
- SESSION.md created this PR
