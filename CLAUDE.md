# Clinic Notes AI - Agent Instructions

## Project Identity

- **Name:** Clinic Notes AI
- **Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Supabase, Tailwind CSS + shadcn/ui, Vercel
- **AI Services:** OpenAI Whisper (transcription), Anthropic Claude (note generation)

## Non-Negotiable Rules

1. Read `AGENTS.md` before making any changes - it is the single source of truth for agent behavior
2. Read `DECISIONS.md` before proposing architectural changes - decisions are locked unless reopened
3. Read `SECURITY.md` before touching auth, RLS, or any data path - security rules are always-on
4. Follow the gate command after every change: `pnpm lint && pnpm typecheck && pnpm test`
5. Never commit `.env.local`, `.env.production`, or any secret material
6. Never log PII - log IDs only, never content
7. RLS policies ship with every schema change, never separated
8. shadcn/ui components must be CLI-initialized before importing

## Current State

- **Milestone:** A (complete)
- **Working features:** Magic link auth, dev-login bypass, session CRUD, job creation and polling, audio upload infrastructure, stub pipeline, transcript viewer, note editor, Copy for CareLogic, DOCX export, CareLogic-aligned workspace shell, and Milestone A E2E coverage
- **Open decisions:** Milestone B execution work remains: real Whisper + Claude integration, kill switch behavior, and multi-provider rollout details

## Key Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Full AI agent contract with domain rules, gate command, operating cadence |
| `DECISIONS.md` | Locked architecture decisions |
| `SECURITY.md` | Threat model, secrets policy, HIPAA checklist |
| `PLAN.md` | Full project blueprint with milestones |
| `.env.example` | All environment variables with descriptions |

## Compliance

### BAA Vendor Status

| Vendor | Status | Guidance |
|--------|--------|----------|
| OpenAI | Pending | Do not treat as cleared for PHI until executed BAA is confirmed |
| Anthropic | Pending | Do not treat as cleared for PHI until executed BAA is confirmed |
| Supabase | Pending | Do not treat as cleared for PHI until executed BAA is confirmed |
| Vercel | Pending | Do not treat as cleared for PHI until executed BAA is confirmed |
| Upstash | Unverified | Upstash docs are contradictory; do not use Redis for PHI or compliance-critical data paths until written BAA confirmation is received from support@upstash.com |

### Consent Gate Pattern

- `ConsentGate` renders before any Record/Upload UI is shown.
- `ConsentGate` posts to `/api/sessions/[sessionId]/consent` to persist HIPAA / Part 2 consent.
- `/api/jobs` must perform a server-side `session_consents` existence check before allowing `createJob`.
- UI gates are not sufficient by themselves; the jobs route must remain the backend enforcement point.

### Audit Write Pattern

- Call `writeAuditLog(...)` only after the primary operation succeeds.
- Never write audit records before the primary write/network action has succeeded.
- Never put the primary success-path audit write in a `catch` block.
- Audit writes must remain best-effort and must never break the primary request path.
- Worker and pipeline contexts must pass `actorId` explicitly, typically `job.created_by`.

### File Encoding Rule

- All PowerShell file writes must use UTF-8 without BOM.
- Required pattern:

```powershell
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
```

- Do not use `Set-Content` or `Out-File` for source files unless the encoding behavior is explicitly controlled and verified.