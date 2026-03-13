# PLAN.md
## Current Milestone: Beta Launch
## Target: March 2026

### Done
- [x] Structured logging helper for API routes
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
- [ ] Auth path tests (callback, logout, session parsing)
- [ ] Upload and CareLogic route tests
- [ ] E2E core-loop spec completion
- [ ] Document Supabase dev/prod split in tracked docs
- [ ] Populate docs/RUNBOOK.md with production deployment details
- [ ] Send beta invites to 5 Community Behavioral Health clinicians

### Blocked
- [ ] Beta clinician invites - blocked by: Sentry not configured (decision: no invites until error monitoring is live)