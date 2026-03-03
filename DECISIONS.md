# Architecture Decisions — Clinic Notes AI

This file records architectural decisions and their rationale. Entries are append-only.

---

## D001: Supabase Storage over Filesystem Artifacts

**Date:** 2026-03-03
**Status:** Accepted
**Context:** The predecessor project (ai-session-notes) stored audio, transcripts, and drafts on the local filesystem in `.artifacts/`. This required TTL-based cleanup, purge logic, and made the app stateful on the compute side.
**Decision:** All file artifacts (audio, transcripts, drafts) are stored in Supabase Storage buckets with RLS policies scoped to org membership.
**Consequence:** The app is stateless on the compute side (critical for Vercel). No filesystem cleanup logic needed. Supabase handles retention and access control.

---

## D002: Database Job State over In-Memory Store

**Date:** 2026-03-03
**Status:** Accepted
**Context:** The predecessor project used an in-memory job store plus filesystem `status.json` files. This was fragile across deploys and serverless cold starts.
**Decision:** All job state lives in the `jobs` table in Supabase with status, progress, and stage columns.
**Consequence:** Job state survives deploys and cold starts. Enables multiple serverless instances to read job state. Concurrent job guard uses DB-level constraints instead of file locks.

---

## D003: Multi-Practice Isolation via RLS from Day One

**Date:** 2026-03-03
**Status:** Accepted
**Context:** Target is small clinics (2-5 providers). Data isolation between practices is non-negotiable given PHI sensitivity.
**Decision:** Every table has an `org_id` column. All queries gated by `is_org_member(org_id)` RLS function. No exceptions.
**Consequence:** Data isolation is enforced at the database level, not the application level. Even a bug in application code cannot leak data across practices.

---

## D004: AI Kill Switch from Day One

**Date:** 2026-03-03
**Status:** Accepted
**Context:** AI API calls cost money. Development and testing should not require real API spend.
**Decision:** Two flags: `AI_ENABLE_REAL_APIS` and `AI_ENABLE_STUB_APIS`. Stub mode returns fake data. Both can be on simultaneously (stub takes precedence in tests).
**Consequence:** CI/CD runs without API keys. Developers can work offline. Cost is controlled.

---

## D005: Stack Locked

**Date:** 2026-03-03
**Status:** Accepted
**Decision:** Next.js 15 (App Router), React 19, TypeScript (strict), Supabase, Tailwind CSS + shadcn/ui, Vercel. No Laravel, Flask, Django, or raw Express. If something genuinely requires leaving this stack, it must be raised as a decision gate.
