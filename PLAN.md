# PLAN.md
## Current Milestone: Beta Launch
## Target: March 2026

### Done
- [x] Batch 2: UI reframe - transcript-first flow, EHR Fields rename, Advanced menu for note generation
- [x] Pipeline change: job completes after transcription, note generation is optional
- [x] Structured logging helper for API routes
- [x] Auth path tests (callback, logout, session parsing)
- [x] Upload and CareLogic route tests
- [x] Fix flaky E2E dev-login cookie handling (removed E2E from CI, runs locally only)
- [x] Remove WMA from accepted upload formats (Whisper does not support WMA)
- [x] Fix hardcoded recording.webm filename in transcription pipeline
- [x] Supabase schema, migrations, and RLS policies (PRs #1-6)
- [x] Magic link auth with middleware protection (PRs #3-5)
- [x] Session CRUD (create, list, detail views) (PR #6)
- [x] Audio upload - drag-and-drop, WMA support, 24MB cap with guidance (PRs #7-9)
- [x] Whisper transcription pipeline via Vercel functions (PR #10)
- [x] Claude note generation from transcripts (PR #11)
- [x] Note editor with CareLogic field extraction and editable fields (PRs #12-13)
- [x] CareLogic copy with mandatory header block (PR #13)
- [x] .docx export (PR #13)
- [x] Invite-based admin onboarding system (PRs #14-15)
- [x] GitHub Actions CI pipeline
- [x] Vercel function timeout set to 300s
- [x] System prompt v4-6 and diff-smell checklist committed to docs/
- [x] Governance cleanup - CLAUDE.md archived, AGENTS.md authority clarified
- [x] Sentry installation and configuration

### In Progress
- [ ] Audit findings remediation - Brian

### Up Next
- [ ] Monthly memory-bank review: promote repeated lessons to CLAUDE-patterns.md or the global system prompt
- [ ] Batch 3: Session delete capability (clinicians own, admins any, hard delete with confirmation)
- [ ] Batch 4: Wipe test sessions from database before beta invites
- [ ] Document Supabase dev/prod split in tracked docs
- [ ] Populate docs/RUNBOOK.md with production deployment details
- [ ] Run Playwright E2E against Vercel preview deployment URL in CI (requires Supabase access)
- [ ] Add server-side WMA->MP3 conversion for upload if beta users request WMA support
- [ ] Harden session revocation to fail closed during Redis/Upstash outages (pre-production)
- [ ] Tighten RLS UPDATE policies on sessions and notes to enforce immutable relationship fields (pre-production)
- [ ] Fix callback route to return 400 when neither code nor token_hash is present
- [ ] Move revocation check into session.ts or add dedicated revocation test at middleware level
- [ ] Send beta invites to 5 Community Behavioral Health clinicians

### Blocked
- [ ] Beta clinician invites - blocked by: final product walkthrough with real clinician audio
