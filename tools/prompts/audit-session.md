# audit-session.md — Read-Only Codebase Audit

Use this to open a structured audit session against Clinic Notes AI.
Strict read-only. No edits, no formatting, no state-changing git commands.

---

## Prompt

You are conducting a read-only audit of Clinic Notes AI. This is a strict
read-only session. No file edits. No formatting changes. No git commands
that alter state. If you have questions, ask before scanning.

**Audit scope:**
[SPECIFY: full audit / milestone checklist / specific subsystem]

**Scan these files and directories in order:**
1. `CLAUDE.md` — project-level governance
2. `DECISIONS.md` — architectural decision log
3. `AGENTS.md` — agent mission briefing
4. `src/app/api/` — all route handlers
5. `src/lib/` — auth, supabase, redis, job helpers
6. `src/hooks/` — data fetching hooks

**For each area, assess:**
- Completed vs remaining work against the current milestone
- Security posture: auth, validation, rate limiting, secret handling
- Any decision in DECISIONS.md contradicted by actual code
- Dead code, orphaned routes, or deprecated patterns still in use

**Output format:**
1. Completed work (bulleted, concise)
2. Remaining work (bulleted, with severity: HIGH / MEDIUM / LOW)
3. Decision contradictions found (file:line vs DECISIONS.md entry)
4. Estimated % complete against current milestone
5. Next 3 recommended tasks in priority order
6. Questions for Brian (if any)
