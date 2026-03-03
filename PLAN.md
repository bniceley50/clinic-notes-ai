# Clinic Notes AI — Full Blueprint

> **Date:** 2026-03-03
> **Owner:** Brian (bniceley50)
> **Status:** DRAFT — awaiting approval before any code is written

---

## 0. Project Identity

| Field | Value |
|---|---|
| **Name** | Clinic Notes AI |
| **Purpose** | End-to-end clinical documentation tool for small clinics (2–5 providers). Record → transcribe → draft note → review/edit → export. |
| **Stack** | Next.js 15 (App Router), React 19, TypeScript (strict), Supabase, Tailwind CSS + shadcn/ui, Vercel |
| **AI Services** | OpenAI Whisper (transcription), Anthropic Claude (note generation) |
| **Local path** | `N:\Clinic Notes AI` |
| **Remote** | `github.com/bniceley50/clinic-notes-ai` (public) |
| **Data posture** | Architect for real PHI from day one. Fake data only until HIPAA review complete. |

---

## 1. Repo Setup — Step by Step

### 1a. Create GitHub Repository

```bash
# From any terminal with gh CLI authenticated
gh repo create clinic-notes-ai --public --description "AI-powered clinical documentation for small clinics" --clone=false
```

### 1b. Local Init on N:\ Drive

```powershell
# PowerShell on Windows
cd N:\
npx create-next-app@latest "Clinic Notes AI" --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
cd "N:\Clinic Notes AI"

# Connect to GitHub remote
git remote add origin https://github.com/bniceley50/clinic-notes-ai.git

# Initial commit + push
git add -A
git commit -m "chore: scaffold Next.js 15 project"
git push -u origin main
```

### 1c. Install Core Dependencies (Day One)

```bash
# Supabase
pnpm add @supabase/supabase-js @supabase/ssr

# Auth
pnpm add jose

# AI SDKs
pnpm add openai @anthropic-ai/sdk

# UI
pnpm add class-variance-authority clsx tailwind-merge lucide-react sonner next-themes

# Export
pnpm add docx

# Dev
pnpm add -D @playwright/test tsx
```

### 1d. shadcn/ui Init

```bash
pnpm dlx shadcn@latest init
# Style: new-york
# Base color: zinc
# CSS variables: yes
```

Then install only the components needed for Milestone 0 (see §5):

```bash
pnpm dlx shadcn@latest add button textarea select separator alert-dialog dropdown-menu skeleton
```

### 1e. Day-One Files to Create Before Any Feature Code

| File | Purpose |
|---|---|
| `.env.example` | Template with all env vars (no real values) |
| `.env.local` | Dev credentials (gitignored) |
| `.gitignore` | Must include `.env`, `.env.local`, `.env.production`, `.env*.local`, `*.pem`, `/supabase/.temp`, `.artifacts/` |
| `CLAUDE.md` | Agent instructions for this repo |
| `AGENTS.md` | Agent contract (filled in — see §8) |
| `DECISIONS.md` | Architecture decision log |
| `SECURITY.md` | Threat model and data handling policy |
| `.github/labels.json` | Label taxonomy (see workflow doc §16) |

---

## 2. Directory Structure

```
N:\Clinic Notes AI\
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── (auth)/                       # Auth route group (no layout chrome)
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/                  # Authenticated route group
│   │   │   ├── layout.tsx                # Sidebar + header shell
│   │   │   ├── page.tsx                  # Dashboard home (recent sessions)
│   │   │   ├── sessions/
│   │   │   │   ├── page.tsx              # Session list
│   │   │   │   ├── new/page.tsx          # Create session
│   │   │   │   └── [sessionId]/
│   │   │   │       ├── page.tsx          # Session workspace (4-panel)
│   │   │   │       └── loading.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx              # User/practice settings
│   │   │   └── providers/
│   │   │       └── page.tsx              # Provider management (Milestone B)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── callback/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── dev-login/route.ts    # Dev only
│   │   │   ├── jobs/
│   │   │   │   ├── route.ts              # POST create, GET list
│   │   │   │   ├── [jobId]/
│   │   │   │   │   ├── route.ts          # GET status, DELETE cancel
│   │   │   │   │   ├── upload/route.ts   # POST audio
│   │   │   │   │   ├── transcript/route.ts
│   │   │   │   │   ├── draft/route.ts
│   │   │   │   │   ├── export/route.ts
│   │   │   │   │   └── events/route.ts   # SSE
│   │   │   │   └── runner/route.ts       # Scheduled processor
│   │   │   ├── sessions/
│   │   │   │   ├── route.ts              # GET list, POST create
│   │   │   │   └── [sessionId]/
│   │   │   │       ├── route.ts          # GET, PATCH, DELETE
│   │   │   │       └── notes/route.ts    # GET, POST
│   │   │   ├── health/route.ts
│   │   │   └── me/route.ts
│   │   ├── layout.tsx                    # Root layout (fonts, providers)
│   │   ├── globals.css
│   │   ├── not-found.tsx
│   │   └── error.tsx                     # Global error boundary
│   │
│   ├── components/
│   │   ├── ui/                           # shadcn components (CLI-managed)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── session/
│   │   │   ├── AudioInput.tsx
│   │   │   ├── TranscriptViewer.tsx
│   │   │   ├── NoteViewer.tsx
│   │   │   ├── NoteEditor.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   └── SessionList.tsx
│   │   ├── job/
│   │   │   ├── JobStatusChip.tsx
│   │   │   ├── JobProgress.tsx
│   │   │   └── JobPanel.tsx
│   │   └── providers/
│   │       ├── ThemeProvider.tsx
│   │       ├── SupabaseProvider.tsx
│   │       └── SessionJobProvider.tsx    # Job state context
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                # Browser client
│   │   │   ├── server.ts                # Server client (cookies)
│   │   │   ├── admin.ts                 # Service role client
│   │   │   ├── middleware.ts            # Auth middleware helper
│   │   │   └── types.ts                 # Generated Supabase types (committed)
│   │   ├── auth/
│   │   │   └── session.ts               # JWT cookie create/read/clear
│   │   ├── jobs/
│   │   │   ├── pipeline.ts              # Orchestration: transcribe → draft → export
│   │   │   ├── whisper.ts               # OpenAI Whisper API wrapper
│   │   │   ├── claude.ts                # Anthropic Claude API wrapper
│   │   │   ├── types.ts                 # Job status, stage, progress types
│   │   │   ├── status.ts               # Job status read/write (Supabase)
│   │   │   └── runner.ts               # Scheduled job processor
│   │   ├── export/
│   │   │   └── docx.ts                  # .docx generation
│   │   ├── config.ts                    # Typed env config + validation
│   │   └── utils.ts                     # cn() helper
│   │
│   ├── hooks/
│   │   ├── useJob.ts                    # Job polling/SSE hook
│   │   └── useSession.ts               # Session data hook
│   │
│   └── types/
│       ├── database.ts                  # Supabase generated types
│       └── index.ts                     # App-level shared types
│
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql     # Tables + RLS (see §4)
│
├── tests/
│   ├── e2e/
│   │   ├── core-loop.spec.ts
│   │   ├── selectors.ts
│   │   └── fixtures/
│   ├── unit/
│   │   └── (mirrors src/ structure)
│   ├── helpers.ts
│   └── setup-env.ts
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                       # Lint + typecheck + unit tests on PR
│   │   ├── e2e.yml                      # Playwright on PR
│   │   ├── repo-hygiene-pr.yml
│   │   ├── repo-hygiene-nightly.yml
│   │   └── repo-hygiene-weekly-autofix.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml
│   │   └── feature.yml
│   ├── pull_request_template.md
│   └── labels.json
│
├── tools/
│   ├── hygiene-audit.mjs
│   ├── hygiene-autofix.mjs
│   └── sync-labels.mjs
│
├── docs/
│   ├── DEMO.md                          # How to demo the app locally
│   ├── RUNBOOK_DEV.md                   # Dev setup and common fixes
│   └── ARCHITECTURE.md                  # Data flow, components, milestones
│
├── public/
│   └── (static assets)
│
├── .env.example
├── .gitignore
├── .editorconfig
├── CLAUDE.md
├── AGENTS.md
├── DECISIONS.md
├── SECURITY.md
├── README.md
├── middleware.ts                         # Next.js middleware (auth gate)
├── next.config.ts
├── tsconfig.json
├── playwright.config.ts
├── components.json                      # shadcn config
├── eslint.config.mjs
├── package.json
├── pnpm-lock.yaml
└── vercel.json
```

### Key Structural Changes from ai-session-notes

| Change | Why |
|---|---|
| Route groups `(auth)` and `(dashboard)` | Clean layout separation — auth pages have no sidebar/chrome |
| `src/hooks/` directory | Custom hooks extracted from components for reuse |
| `src/types/` directory | Centralized type definitions |
| `components/layout/` | Shell components (sidebar, header) separated from feature components |
| `components/providers/` | Context providers grouped together |
| Flatten job API routes | `POST /api/jobs` instead of `POST /api/jobs/create` — more RESTful |
| Remove filesystem artifacts | Jobs stored in Supabase storage, not `.artifacts/` directory |
| Remove in-memory job store | All job state in Supabase `jobs` table |

---

## 3. Database Schema (Supabase)

### Tables

```sql
-- Organizations / Practices
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles (linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id),
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'provider', -- 'admin' | 'provider'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- Sessions (patient encounters / appointments)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  patient_label TEXT, -- display-only label, NOT a real name in v0
  session_type TEXT DEFAULT 'general', -- 'intake' | 'follow-up' | 'general'
  status TEXT DEFAULT 'active', -- 'active' | 'completed' | 'archived'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs (transcription + note generation pipeline)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'complete' | 'failed' | 'cancelled'
  progress INTEGER DEFAULT 0, -- 0-100
  stage TEXT DEFAULT 'queued', -- 'queued' | 'transcribing' | 'drafting' | 'exporting' | 'complete' | 'failed'
  note_type TEXT DEFAULT 'soap', -- 'soap' | 'dap' | 'birp' | 'girp' | 'intake' | 'progress'
  error_message TEXT,
  audio_storage_path TEXT, -- Supabase Storage path
  transcript_storage_path TEXT,
  draft_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notes (clinician-edited final notes)
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id),
  job_id UUID REFERENCES jobs(id),
  content TEXT NOT NULL DEFAULT '',
  note_type TEXT DEFAULT 'soap',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transcripts (stored separately for reuse across note types)
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  content TEXT NOT NULL,
  duration_seconds INTEGER,
  word_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies

```sql
-- Helper function (reused across all tables)
CREATE OR REPLACE FUNCTION is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND org_id = check_org_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Apply to every table: SELECT, INSERT, UPDATE, DELETE
-- all gated by is_org_member(org_id)
-- INSERT additionally checks: created_by = auth.uid()
```

### Supabase Storage Buckets

| Bucket | Purpose | RLS |
|---|---|---|
| `audio` | Raw audio uploads | Scoped to org via job ownership |
| `transcripts` | Transcript text files | Scoped to org |
| `drafts` | AI-generated note drafts | Scoped to org |

**Key change from ai-session-notes:** All file artifacts move from local filesystem (`.artifacts/`) to Supabase Storage. This eliminates the TTL/cleanup complexity and makes the app stateless on the compute side (critical for Vercel).

---

## 4. Environment Variables

```env
# === Supabase (Required) ===
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# === Auth (Required) ===
AUTH_COOKIE_SECRET=          # 32+ byte hex for JWT signing
DEFAULT_PRACTICE_ID=         # Default org UUID for bootstrapping
SESSION_TTL_SECONDS=28800    # Cookie expiry (8 hours)

# === AI APIs (Required for real mode) ===
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# === AI Control Flags ===
AI_ENABLE_REAL_APIS=0        # Set to 1 for real transcription/generation
AI_ENABLE_STUB_APIS=1        # Set to 1 for testing without API spend

# === AI Timeouts (Optional) ===
AI_WHISPER_TIMEOUT_MS=120000
AI_CLAUDE_TIMEOUT_MS=90000

# === Job Config (Optional) ===
JOB_TTL_SECONDS=86400        # Auto-cleanup after 24h

# === Security ===
JOBS_RUNNER_TOKEN=           # Token for /api/jobs/runner endpoint

# === Dev Only (Never in production) ===
ALLOW_DEV_LOGIN=0
```

---

## 5. Milestones

### Milestone 0: Foundation (Week 1)

**Goal:** Repo scaffolded, CI green, auth working, empty dashboard renders.

| Task | Acceptance Criteria |
|---|---|
| Create GitHub repo + local clone on N:\ | `git remote -v` shows correct origin |
| Scaffold Next.js 15 + install deps | `pnpm dev` starts without errors |
| Configure TypeScript strict, ESLint, Tailwind | `pnpm lint && pnpm typecheck` passes |
| Set up shadcn/ui (button, textarea, select, separator, alert-dialog, dropdown-menu, skeleton) | Components render in dev |
| Create `.env.example`, `.gitignore`, `.editorconfig` | All env patterns gitignored |
| Set up Supabase project (dev) + run initial migration | Tables exist, RLS enabled |
| Implement auth flow (Supabase Auth + JWT cookie) | User can sign in and reach `/` |
| Middleware: protect all routes except `/login`, `/api/auth/*`, `/api/health` | Unauthenticated requests redirect to `/login` |
| Dashboard shell: sidebar, header, theme toggle | Authenticated user sees empty dashboard |
| `error.tsx` at root + `(dashboard)` layout | Errors render recovery UI, not blank screen |
| CI workflow: lint + typecheck on PR | GitHub Actions green on push |
| Day-one docs: AGENTS.md, DECISIONS.md, SECURITY.md, README.md | Files exist and are populated |

**Checkpoint:** Auth flow complete. User can sign in and land on dashboard without 500 or redirect loop.

---

### Milestone A: Core Loop — Local Demo (Weeks 2–3)

**Goal:** End-to-end flow works with stub data. No real API calls needed.

| Task | Acceptance Criteria |
|---|---|
| Session CRUD: create, list, view | Sessions appear in list, workspace loads |
| Audio upload to Supabase Storage | File stored, path saved on job record |
| Job creation + status tracking | Job created in `jobs` table, status updates visible |
| Stub pipeline: fake transcription + fake note | Pipeline runs, writes stub transcript + draft |
| SSE endpoint for job progress | UI updates in real-time during stub pipeline |
| Transcript viewer | Displays transcript after job completes |
| Note viewer + editor | Displays AI draft, user can edit |
| Copy to clipboard + .docx export | Both work from the note editor |
| Session workspace: 4-panel layout (audio, transcript, note, editor) | All panels render and update |
| E2E test: happy path (stub mode) | Playwright test passes in CI |
| Dev-login bypass for testing | `ALLOW_DEV_LOGIN=1` skips OAuth |

**Checkpoint:** Core loop complete (stub mode). User can upload audio → see stub transcript → see stub note → edit → export, all without real API spend.

---

### Milestone B: Real AI Pipeline (Weeks 4–5)

**Goal:** Real Whisper + Claude integration. Kill switch controls.

| Task | Acceptance Criteria |
|---|---|
| Whisper integration (single file) | Real audio produces real transcript |
| Whisper chunked transcription (>24MB files) | Large files split, transcribed, stitched |
| Claude note generation (all 6 note types) | Transcript → SOAP/DAP/BIRP/GIRP/Intake/Progress |
| AI kill switch (`AI_ENABLE_REAL_APIS`) | Toggle between real and stub mode |
| Timeout wrappers on API calls | Jobs fail gracefully on timeout |
| Job cancellation | User can cancel in-flight job |
| Concurrent job guard | Only one active job per session |
| Runner endpoint for scheduled processing | `/api/jobs/runner` processes queued jobs |
| Provider management page (basic) | Admin can see practice members |

**Checkpoint:** Real pipeline complete. Real audio → real transcript → real note → edit → export, with kill switch and cancellation.

---

### Milestone C: Production Hardening (Weeks 6–7)

**Goal:** Production-ready. Error states, loading states, mobile, logging.

| Task | Acceptance Criteria |
|---|---|
| Error states on every async operation | User sees actionable error, not blank screen |
| Loading states + skeletons throughout | Every data-fetching view shows loading UI |
| Form validation with user-facing messages | Invalid input shows clear error |
| Mobile-first responsive layout | Usable on tablet (clinic use case) |
| Input validation on every write path | API routes reject malformed input |
| Server-side error logging | Errors logged with context, no PII in logs |
| RLS policy review against user stories | Every query scoped correctly |
| Audit logging (who did what, when) | `audit_log` table captures key actions |
| Two Supabase projects: dev + prod | Separate credentials, separate data |
| Vercel deployment pipeline | Push to main → deploy to production |
| Rate limiting on API routes | Prevent abuse of AI endpoints |
| `SECURITY.md` updated with threat model | Document covers all data flows |
| E2E tests: cancel, delete, error flows | Full test coverage in CI |

**Checkpoint:** Production hardened. App handles errors gracefully, loads quickly on mobile, RLS verified, audit trail active.

---

### Milestone D: Polish & Launch (Week 8+)

| Task | Acceptance Criteria |
|---|---|
| Session history + search | User can find past sessions |
| Note templates / customization | Practice can configure note preferences |
| Bulk export | Export multiple notes at once |
| Practice settings page | Admin can manage practice details |
| `docs/DEMO.md` — full demo walkthrough | New user can demo in <5 minutes |
| `docs/RUNBOOK_DEV.md` — dev setup guide | New dev can set up in <15 minutes |
| `docs/ARCHITECTURE.md` — system overview | 1-2 page data flow + component map |
| Performance audit (Lighthouse, Core Web Vitals) | All routes score 90+ |
| Secret scanning flag + review | GitHub secret scanning evaluated |

---

## 6. Migration Assessment — What to Bring from ai-session-notes

### Migrate (adapt & improve)

| Module | From (ai-session-notes) | Action |
|---|---|---|
| **Job pipeline orchestration** | `src/lib/jobs/pipeline.ts` | Adapt — core logic is solid, update to use Supabase Storage instead of filesystem |
| **Whisper wrapper** | `src/lib/jobs/whisper.ts` | Migrate — API wrapper is clean, keep chunked transcription |
| **Claude wrapper** | `src/lib/jobs/claude.ts` | Migrate — note generation prompts are tuned, bring them |
| **Typed env config** | `src/lib/config.ts` | Migrate — eager validation pattern is good |
| **Auth session (JWT)** | `src/lib/auth/session.ts` | Migrate — cookie create/read/clear is clean |
| **DOCX export** | `src/lib/export/docx.ts` | Migrate as-is |
| **API error helpers** | `src/lib/api/errors.ts` | Migrate as-is |
| **Ownership guards** | `src/lib/api/requireSessionOwner.ts`, `requireJobOwner.ts` | Migrate — adapt for new schema |
| **Middleware** | `middleware.ts` | Migrate — update route matchers for new structure |
| **E2E test patterns** | `tests/e2e/*.spec.ts` | Adapt — test IDs and selectors, rewrite scenarios |
| **CI workflows** | `.github/workflows/` | Migrate — e2e, hygiene, runner schedule |
| **Hygiene tooling** | `tools/hygiene-*.mjs` | Migrate as-is |
| **RLS pattern** | `supabase/migrations/` | Adapt — `is_org_member()` approach stays, expand tables |
| **Note type prompts** | (embedded in claude.ts) | Extract into separate prompt files for easier tuning |

### Redesign from scratch

| Area | Why |
|---|---|
| **UI / Components** | Current UI is minimal 4-panel grid. Rebuild with proper dashboard, sidebar navigation, session list, mobile responsiveness. |
| **Session management** | Current: single workspace view. New: full CRUD, list, search, archive. |
| **Job storage** | Current: filesystem `.artifacts/`. New: Supabase Storage (stateless compute). |
| **Job state** | Current: in-memory store + filesystem status.json. New: `jobs` table in Supabase. |
| **Provider management** | Current: not implemented. New: basic multi-provider support from Milestone B. |
| **Settings** | Current: not implemented. New: practice settings, note preferences. |

### Drop entirely

| Item | Why |
|---|---|
| In-memory job store (`src/lib/jobs/store.ts`) | Replaced by Supabase `jobs` table |
| Filesystem artifacts (`.artifacts/`, `artifacts.ts`, `cleanup.ts`, `purge.ts`) | Replaced by Supabase Storage |
| Session lock files (`sessionLock.ts`) | Replace with DB-level locking (row lock or advisory lock) |
| `SessionHistoryStrip` component | Was a stub, never completed |
| `jspdf` dependency | Not needed — .docx + clipboard is sufficient |
| `.codex/` skills directory | Replace with project-specific CLAUDE.md |
| `SKILLS/` reference directory | Not needed in new repo |
| Vercel cron complexity | Simplify — use Supabase Edge Functions or Vercel cron directly |

---

## 7. Workflows & CI/CD

### GitHub Actions

#### `ci.yml` — On every PR to `main`

```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

#### `e2e.yml` — On PR to `main`

```yaml
name: E2E
on:
  pull_request:
    branches: [main]
jobs:
  playwright:
    runs-on: ubuntu-latest
    env:
      AI_ENABLE_STUB_APIS: "1"
      AI_ENABLE_REAL_APIS: "0"
      ALLOW_DEV_LOGIN: "1"
      # ... stub credentials
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test
```

#### `repo-hygiene-pr.yml` — PR quality gate

Runs `pnpm hygiene:audit --mode local`. P0/P1 findings block merge.

#### `repo-hygiene-nightly.yml` — Deep audit

Daily cron. Opens GitHub issues for P1/P2 findings.

#### `repo-hygiene-weekly-autofix.yml` — Auto-cleanup

Weekly cron. Opens PR with automated fixes.

### Branch Strategy

| Branch | Purpose | Protection |
|---|---|---|
| `main` | Production-ready code | PR required, CI must pass, 1 approval (self-review OK for solo) |
| `feature/*` | Feature development | No protection, push freely |
| `fix/*` | Bug fixes | No protection |
| `claude/*` | AI agent work branches | No protection |

### Commit Convention

```
[type]: short description

Types: feat, fix, chore, refactor, security, docs, test, ci
```

Mandatory commits when touching: auth, schema, RLS, or in Production Mode.

---

## 8. Agent Contract — Clinic Notes AI (Filled In)

```markdown
# AI Agent Contract — Clinic Notes AI

## 6) Project Identity
Project name: Clinic Notes AI
Purpose: AI-powered clinical documentation tool for small clinics (2–5 providers)
Current milestone: 0 (Foundation)
Stack: Next.js 15 / Supabase / Tailwind / shadcn/ui / Vercel
Repo root: N:\Clinic Notes AI (local) / github.com/bniceley50/clinic-notes-ai (remote)

## 7) Domain Rules and Defaults

AUTH AND PERMISSIONS
- All API routes require session cookie, 401 if missing
- Scope all queries to org_id via is_org_member(), 404 on mismatch
- Provider role can CRUD own sessions and notes
- Admin role can view all sessions in the practice

DATA RULES
- Soft-delete only, never hard-delete patient-related records
- Notes are append-versioned (keep edit history)
- Transcripts are immutable once created
- Job status transitions are one-directional: queued → running → complete|failed|cancelled

STATUS MAPPING DEFAULTS
- upload → uploaded
- transcribe → transcribing → transcribed
- draft → drafting → drafted
- export → exported

IDEMPOTENCY
- If job already at target state, return current record, no duplicate writes
- If session already has an active job, reject new job creation (409)

OTHER DOMAIN RULES
- Never send real PHI to logs (log IDs only)
- Never store real patient names in v0 (use labels like "Patient A", "Session 2026-03-03")
- All AI-generated content must be labeled as AI-generated until clinician reviews
- Export files must include "AI-GENERATED — REVIEW REQUIRED" watermark until clinician signs off

## 8) Artifact and File Structure
Migrations: supabase/migrations/YYYYMMDDHHMM_description.sql
Docs: docs/DEMO.md, docs/RUNBOOK_DEV.md, docs/ARCHITECTURE.md
Audio: Supabase Storage bucket "audio" → audio/{orgId}/{sessionId}/{jobId}/recording.webm
Transcripts: Supabase Storage bucket "transcripts" → transcripts/{orgId}/{sessionId}/{jobId}/transcript.txt
Drafts: Supabase Storage bucket "drafts" → drafts/{orgId}/{sessionId}/{jobId}/note.md

## 9) Gate Command
Gate command: pnpm lint && pnpm typecheck && pnpm test

## 10) Current Working State
Current goal: Scaffold repo and complete Milestone 0
Last known good checkpoint: (none — project not started)
Current schema: (none — no tables yet)
Open decisions: (none yet)

Installed shadcn/ui components (CLI-initialized only):
- (none yet)

Working features (actual only):
- (none yet)

Stubbed or placeholder behavior:
- (none yet)

## 11) Milestone Map
Milestone 0: Foundation — repo, auth, dashboard shell, CI green
Milestone A: Core loop — stub pipeline, session CRUD, workspace UI
Milestone B: Real AI — Whisper + Claude integration, kill switch, multi-provider
Milestone C: Production hardening — errors, loading, mobile, audit, logging
Milestone D: Polish & launch — search, templates, bulk export, docs

Current milestone: 0
Next decision point: Auth provider choice (Supabase Auth magic link vs OAuth vs email/password)

## 12) Multi-Agent Protocol
Builder agent: Claude Code (primary), Codex (secondary)
Reviewer agents: Claude, ChatGPT (diff review)
Coordinator: Brian merges and decides

## 16) Label Taxonomy
Area labels for this project:
- area:auth     src/lib/auth/**, src/app/api/auth/**
- area:api      src/app/api/**
- area:ui       src/components/**
- area:jobs     src/lib/jobs/**
- area:supabase supabase/**
- area:docs     docs/, README, *.md
- area:ci       .github/**
- area:export   src/lib/export/**
```

---

## 9. Repo Best Practices Summary

### Day-One Non-Negotiables

1. **`.gitignore` before first commit** — all `.env*`, `*.pem`, `supabase/.temp`
2. **TypeScript strict mode** — no `any` without written justification
3. **RLS on every table** — no exceptions, ships with every migration
4. **AI kill switch** — `AI_ENABLE_REAL_APIS` / `AI_ENABLE_STUB_APIS` from day one
5. **Typed env config** — no `process.env.FOO` scattered through code, centralized in `config.ts`
6. **Error boundary** — `error.tsx` at root before any feature code
7. **CI green before features** — lint + typecheck passing on `main`

### Code Quality

- **Max complexity 8** per function
- **Max 200 lines** per file — stop and propose boundaries before writing
- **Single responsibility** per function and module
- **Import ordering** enforced by ESLint
- **No custom CSS** unless absolutely necessary — Tailwind utilities only
- **shadcn/ui components must be CLI-installed** before importing

### Security

- **No PII in logs** — log IDs only, never content
- **No real patient data** until HIPAA review
- **Service role key never client-side**
- **Fake data conventions**: names = "Jane Doe" / "Test User", emails = @example.com, phone = 555-xxxx
- **Secret scanning** — flag for enablement at Milestone C

### Git Discipline

- **Commit early, commit often** on auth/schema/RLS changes
- **Feature branches** for all work
- **PR required** to merge to `main`
- **No force push** to `main`
- **Conventional commits**: `[type]: description`

---

## 10. Open Decisions (To Resolve During Build)

| # | Decision | Options | When to Decide |
|---|---|---|---|
| 1 | **Auth method** | Supabase Auth magic link / OAuth (Google) / email+password | Milestone 0 |
| 2 | **Audio recording** | Browser MediaRecorder API vs upload-only | Milestone A |
| 3 | **Note prompt storage** | Hardcoded in claude.ts / separate .md files / DB-configurable per practice | Milestone B |
| 4 | **Job processing model** | Supabase Edge Functions / Vercel serverless with timeout / background job queue | Milestone B |
| 5 | **Audit log scope** | Minimal (auth + delete) / comprehensive (all mutations) | Milestone C |
| 6 | **HIPAA compliance path** | BAA with Supabase / self-hosted Supabase / different DB provider | Before real PHI |
| 7 | **Multi-provider UX** | Shared session view / per-provider isolation / both with toggle | Milestone B |

---

## 11. What's Next (After Plan Approval)

1. **Create the GitHub repo** and scaffold locally on N:\
2. **Implement Milestone 0** — auth, shell, CI, day-one docs
3. **First decision gate** — auth method (magic link vs OAuth vs email+password)
