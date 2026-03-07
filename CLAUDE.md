# Clinic Notes AI — Agent Instructions

## Project Identity

- **Name:** Clinic Notes AI
- **Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Supabase, Tailwind CSS + shadcn/ui, Vercel
- **AI Services:** OpenAI Whisper (transcription), Anthropic Claude (note generation)

## Non-Negotiable Rules

1. Read `AGENTS.md` before making any changes — it is the single source of truth for agent behavior
2. Read `DECISIONS.md` before proposing architectural changes — decisions are locked unless reopened
3. Read `SECURITY.md` before touching auth, RLS, or any data path — security rules are always-on
4. Follow the gate command after every change: `pnpm lint && pnpm typecheck && pnpm test`
5. Never commit `.env.local`, `.env.production`, or any secret material
6. Never log PII — log IDs only, never content
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
