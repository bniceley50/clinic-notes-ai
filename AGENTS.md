> **Source of truth for universal workflow rules:** docs/brian-system-prompt-v4-6.md
> This file contains project-specific extensions only. If AGENTS.md and the
> system prompt conflict, the system prompt wins.

---
# AI Agent Contract — Clinic Notes AI

This file is the single source of truth for how any AI agent (Codex, ChatGPT, Claude, etc.) must behave when working on this repo. If an agent conflicts with this contract, this contract wins.

## 0) Two Modes: READ-ONLY by Default

Default mode: READ-ONLY. You may only inspect, summarize, propose, and produce labeled commands. No file edits, no formatting, no commits, no pushes.

Write mode: only when I include:
`EDIT_OK: [file list or "any files needed for this task"]`

If EDIT_OK is not present, stay READ-ONLY. No exceptions.

## 1) Momentum Rules: No Question Loops

Question budget: 0

Blocked means missing input would cause: incorrect behavior, security risk, destructive changes, or wasted work that must be redone.

If not blocked, pick defaults and proceed.

If you must ask:
- One question, one sentence
- State the default you will use if unanswered
- Proceed immediately using that default

No permission questions for routine steps.

## 2) Operating Cadence: One Change Then Gate

1. Make exactly ONE logical change
2. Run gate: `pnpm lint && pnpm typecheck && pnpm test`
3. Report:
   - Gate result: pass or fail
   - If fail: first error + ~20 lines of context
   - Working tree state: clean or dirty, plus which files

Do not stack multiple unrelated changes in one step.

## 3) Output Contract (Every Response)

- What changed: 1-3 bullets
- Gate result: pass or fail
- If fail: first error + ~20 lines of context
- Next step: one sentence
- Session footer: Questions (blocking): [none / question + default]

Do not paste giant file dumps unless requested.

## 4) Repo Reality Check

If you did not open a file or run a command, do not claim you did. State exactly what is missing and propose the smallest check to confirm.

## 5) Stop Digging Rule

If a change branches into multiple problems: stop, finish the smallest shippable fix, gate, then do the next patch separately. Never refactor while failing.

## 6) Project Identity

- **Project name:** Clinic Notes AI
- **Purpose:** AI-powered clinical documentation tool for small clinics (2-5 providers). Record, transcribe, draft clinical notes, review/edit, and export.
- **Current milestone:** A (complete)
- **Stack:** Next.js 15 / Supabase / Tailwind / shadcn/ui / Vercel
- **Repo root (local):** `N:\Clinic Notes AI`
- **Repo root (remote):** `github.com/bniceley50/clinic-notes-ai`

## 7) Domain Rules and Defaults

Use these instead of asking.

### AUTH AND PERMISSIONS
- All API routes require session cookie, 401 if missing
- Scope all queries to org_id via `is_org_member()`, 404 on mismatch
- Provider role can CRUD own sessions and notes
- Admin role can view all sessions in the practice

### DATA RULES
- Soft-delete only, never hard-delete patient-related records
- Notes are append-versioned (keep edit history)
- Transcripts are immutable once created
- Job status transitions are one-directional: queued -> running -> complete|failed|cancelled

### STATUS MAPPING DEFAULTS
- upload -> uploaded
- transcribe -> transcribing -> transcribed
- draft -> drafting -> drafted
- export -> exported

### IDEMPOTENCY
- If job already at target state, return current record, no duplicate writes
- If session already has an active job, reject new job creation (409)

### OTHER DOMAIN RULES
- Never send real PHI to logs (log IDs only)
- Never store real patient names in v0 (use labels like "Patient A", "Session 2026-03-03")
- All AI-generated content must be labeled as AI-generated until clinician reviews
- Export files must include "AI-GENERATED - REVIEW REQUIRED" watermark until clinician signs off

## 8) Artifact and File Structure

- **Migrations:** `supabase/migrations/YYYYMMDDHHMM_description.sql`
- **Docs:** `docs/DEMO.md`, `docs/RUNBOOK_DEV.md`, `docs/ARCHITECTURE.md`
- **Audio:** Supabase Storage bucket `audio` -> `audio/{orgId}/{sessionId}/{jobId}/recording.webm`
- **Transcripts:** Supabase Storage bucket `transcripts` -> `transcripts/{orgId}/{sessionId}/{jobId}/transcript.txt`
- **Drafts:** Supabase Storage bucket `drafts` -> `drafts/{orgId}/{sessionId}/{jobId}/note.md`

## 9) Gate Command

```bash
pnpm lint && pnpm typecheck && pnpm test
```

If gate fails: stop, fix only what is required to get gate green, gate again. No refactors while failing.

## 10) Current Working State

```
Current goal: Prepare for Milestone B real AI integration from a stable Milestone A baseline
Last known good checkpoint: Milestone A complete on main with session CRUD, provider-owned jobs, worker updates, note editing, export flow, and E2E coverage
Current schema: orgs, profiles, sessions, jobs, transcripts, notes, audit_log; jobs include audio/transcript/draft storage path fields; storage bucket config and migration are present in repo
Open decisions: None reopened from Milestone A; next implementation milestone is B (real AI pipeline)
```

**Locked decisions (D006–D012):**
- D006: Auth — Supabase email magic link only for Milestone 0
- D007: Jobs — DB-backed job rows with one controlled worker path; one active job per session enforced by DB constraint
- D008: Retention — Soft-delete rows; hard-delete artifacts/blobs only after TTL
- D009: RLS — Strict single-owner; provider owns own records, admin read-all, service role for workers only
- D010: Prompts — Versioned prompt files in repo (`/prompts/*.md`)
- D011: Audit — Auth, job lifecycle, note edit, export; no raw PHI in audit payloads
- D012: PHI gate — Fake/sanitized data only until formal checklist passes

**Installed shadcn/ui components (CLI-initialized only):**
- (none yet)

**Working features (actual only, not planned or assumed):**
- Magic link auth
- Dev-login bypass for local/demo use
- Session list, create flow, and detail page
- Provider-owned job creation with one-active-job enforcement
- Worker update path with status polling in the session workspace
- Audio upload infrastructure for queued jobs
- Transcript viewing in the session workspace
- Note editing and review workflow
- Copy for CareLogic and DOCX export
- CareLogic-aligned shell, navigation, dashboard, schedule, and reports views
- Milestone A happy-path E2E coverage

**Stubbed or placeholder behavior (label DEMO/STUB in code and docs):**
- (none yet)

## 11) Milestone Map

| Milestone | Description |
|-----------|-------------|
| **0** | Foundation - repo, auth, dashboard shell, CI green |
| **A** | Core loop - stub pipeline, session CRUD, workspace UI |
| **B** | Real AI - Whisper + Claude integration, kill switch, multi-provider |
| **C** | Production hardening - errors, loading, mobile, audit, logging |
| **D** | Polish & launch - search, templates, bulk export, docs |

**Current milestone:** A (complete)
**Next decision point:** Milestone B execution: wire real Whisper + Claude processing, define kill switch behavior, and keep multi-provider support aligned with locked decisions.

## 12) Multi-Agent Protocol

- **Builder agent:** Claude Code (primary), Codex (secondary)
- **Reviewer agents:** Claude, ChatGPT (diff review)
- **Coordinator:** Brian merges and decides

Peer review handoff format:
- Provide: diff, files changed, acceptance criteria
- Request: risks, edge cases, security concerns
- Rule: reviewers flag only, do not rewrite unless explicitly asked

## 13) Formatting Policy

- No whitespace-only changes
- No drive-by refactors
- No reformatting of unrelated files
- Keep diffs tight
- Every change must have a stated reason

## 14) Weekly Quality Pass (Once Per Week, Not Every Day)

- Remove dead code
- Tighten types
- Add 1-2 tests where coverage is missing
- Update DECISIONS.md if anything architectural changed

Keep it small and boring. Prevent rot.

## 15) Docs Minimum (Add Over Time, Small Patches)

- `docs/DEMO.md` - Exact steps to demo the app (no cloud required for local demo)
- `docs/RUNBOOK_DEV.md` - Dev setup and common fixes
- `docs/ARCHITECTURE.md` - Data flow, components, milestones (1-2 pages max)
- `DECISIONS.md` - Architectural decisions and why
- `SECURITY.md` - Threat model and known risks
- `AGENTS.md` - This file

Any stubbed behavior must be labeled DEMO/STUB in code or docs.

## 16) Label Taxonomy

Source of truth: `.github/labels.json`

### Area labels for this project:
- `area:auth` — `src/lib/auth/**`, `src/app/api/auth/**`
- `area:api` — `src/app/api/**`
- `area:ui` — `src/components/**`
- `area:jobs` — `src/lib/jobs/**`
- `area:supabase` — `supabase/**`
- `area:docs` — `docs/`, `README`, `*.md`
- `area:ci` — `.github/**`
- `area:export` — `src/lib/export/**`

### Validation Commands
- Check: `pnpm labels:check:strict`
- Sync: `pnpm labels:sync`

---

If an agent conflicts with this contract, this contract wins.
