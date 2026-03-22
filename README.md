# Clinic Notes AI

AI-powered clinical documentation for small clinics (2-5 providers).

Record/Upload Audio -> Transcribe -> Extract Structured EHR Fields -> Optional Note Generation -> Review/Edit -> Export

## Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript (strict)
- **Database:** Supabase (Postgres, Auth, Storage, RLS)
- **UI:** Tailwind CSS + shadcn/ui
- **AI:** OpenAI Whisper (transcription) + Anthropic Claude (note generation)
- **Deploy:** Vercel

## Quick Start

```bash
# Clone
git clone https://github.com/bniceley50/clinic-notes-ai.git
cd clinic-notes-ai

# Install
pnpm install

# Configure
cp .env.example .env.local
# Fill in your Supabase + API keys

# Run
pnpm dev
```

## Environment Setup

See `.env.example` for all required and optional variables.

**AI Kill Switch:** Set `AI_ENABLE_STUB_APIS=1` and `AI_ENABLE_REAL_APIS=0` to test without spending on API calls.

## Project Docs

| Doc | Purpose |
|-----|---------|
| [PLAN.md](./PLAN.md) | Full project blueprint and milestones |
| [AGENTS.md](./AGENTS.md) | AI agent contract and operating rules |
| [DECISIONS.md](./DECISIONS.md) | Architecture decision log |
| [SECURITY.md](./SECURITY.md) | Threat model and data handling policy |
| [docs/DEMO.md](./docs/DEMO.md) | How to demo the app locally |
| [RUNBOOK.md](./RUNBOOK.md) | Current operational behavior, failure modes, and operator procedures |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Current runtime data flow and component map |

## Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript strict check
pnpm test         # Unit tests
```

## Gate Command

Every change must pass before merge:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## License

Private. All rights reserved.
