# Developer Runbook — Clinic Notes AI

> TODO: Fill in as project is built.

## Setup

```bash
git clone https://github.com/bniceley50/clinic-notes-ai.git
cd clinic-notes-ai
pnpm install
cp .env.example .env.local
# Fill in values
pnpm dev
```

## Common Issues

| Problem | Fix |
|---------|-----|
| TBD | TBD |

## Gate Command

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Memory Bank Review

Once per month:
- Review `tasks/lessons.md` for repeated lessons or validated wins.
- Promote repeated repo-specific rules into `CLAUDE-patterns.md`.
- Escalate repeated `[GLOBAL]` lessons for inclusion in the global system prompt.
- Note whether the same lesson was triggered more than once; if so, strengthen
  the rule or move it to a higher-control layer.
