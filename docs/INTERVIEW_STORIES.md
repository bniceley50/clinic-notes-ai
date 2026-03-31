# Clinic Notes AI - Interview Stories

Use these as concise STAR-style responses for entry-level AI/software interviews.

## Story 1 - Runner reliability + observability

### Situation
The production jobs runner monitor generated repeated failures and low-confidence alerting.

### Task
Make cron health signals reliable enough that alerts represent real failures.

### Action
- Reviewed runner control flow and found check-ins were not consistently tied to every exit path.
- Refactored to send explicit Sentry check-ins for success and failure outcomes.
- Added flush behavior to reduce dropped observability events in short-lived serverless execution.

### Result
- Runner incidents became diagnosable from monitor output.
- Alert quality improved from "missed/noisy" to concrete failure categories.

## Story 2 - Job pipeline race + idempotency hardening

### Situation
In a transcript-first flow, timing races can occur between manual triggers and background runner processing.

### Task
Prevent avoidable job failures and make trigger behavior safe under duplicate calls.

### Action
- Gated queued-job dispatch on uploaded audio presence.
- Updated process handling to treat "already claimed/already running" as idempotent success.
- Isolated worker traffic into dedicated rate-limit keys to avoid interference from user API buckets.

### Result
- Reduced false-start processing and retry burn.
- Trigger endpoint behavior became predictable under concurrency.

## Story 3 - Schema/runtime consistency fix

### Situation
Cancellation behavior changed in route code, but DB constraints and lifecycle handling were not fully aligned.

### Task
Eliminate runtime failure risk and keep state semantics consistent across all layers.

### Action
- Added migration to align allowed stage values.
- Updated lifecycle state normalization and worker-stage validation.
- Re-ran gates (`lint`, `typecheck`, `test`) to ensure no regressions.

### Result
- Removed a 500-risk path in cancellation.
- Established a cleaner pattern for future "schema + runtime + tests" changes.

## Story 4 - Building an AI app with product + engineering balance

### Situation
As a solo developer, I had to build both product UX and production backend reliability for a healthcare-adjacent workflow.

### Task
Deliver an end-to-end user flow while maintaining engineering quality.

### Action
- Built the complete workflow from audio capture to structured clinical output.
- Added operational docs (runbook, decisions, architecture) and CI quality gates.
- Implemented security controls early (RLS, auth boundaries, signed storage paths, CSP hardening).

### Result
- Produced a portfolio-grade SaaS with real AI integration, testing discipline, and operational maturity.

## How to answer "What did you learn?"

- Strong lesson 1: reliability work is a product feature, not just infra work.
- Strong lesson 2: schema/runtime/test alignment is mandatory when moving fast.
- Strong lesson 3: observability must be designed with failure paths, not only happy paths.
