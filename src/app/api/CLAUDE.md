# src/app/api/ — Module Context

## Purpose
All API route handlers for Clinic Notes AI. This module owns every `/api/*` endpoint.
No business logic lives here — routes validate, authorize, delegate to lib/, and return.

## Patterns
- Every route validates input with Zod schemas before any processing
- All protected routes call `requireAuth()` before touching data
- Rate limiting via Upstash Redis on all mutation endpoints
- Consistent error shape: `{ error: string, code?: string }`
- All responses typed — never return `any`

## Key Routes
- `/api/auth/*` — session handling, login, logout, token refresh
- `/api/sessions/*` — clinical session CRUD, cascade delete
- `/api/jobs/*` — background job pipeline (transcription, note generation)
- `/api/transcripts/*` — transcript artifact management
- `/api/notes/*` — structured clinical note output

## Security Rules — Non-Negotiable
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to client or logs
- Validate ALL inputs with Zod — return 400 on failure, never pass raw input downstream
- Log errors with context: `{ route, user_id, error }` — no PII in logs
- Session delete must cascade — no orphaned transcripts or job records
- Webhook endpoints verify signatures before processing
- Rate limits: 10 req/min default, 3 req/min on auth and job creation routes

## Auth Pattern
```ts
const { user, error } = await requireAuth(req)
if (error) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

## Error Pattern
```ts
return NextResponse.json({ error: 'Descriptive message' }, { status: 400 })
```

## EDIT_OK Gate
Do not modify any file in this directory without explicit EDIT_OK from Brian.
Read-only by default in all audit and review sessions.
