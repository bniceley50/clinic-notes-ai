# src/lib/ — Module Context

## Purpose
Shared infrastructure layer. Supabase client, Upstash Redis client, OpenAI/Anthropic
clients, utility functions, and typed system contracts. No route logic. No UI.

## What Lives Here
- `supabase.ts` — typed Supabase client (singleton, server-side)
- `redis.ts` — Upstash Redis client (singleton)
- `openai.ts` — Whisper transcription client
- `anthropic.ts` — Claude API client for note generation
- `auth.ts` — `requireAuth()` and session helpers
- `jobs.ts` — job pipeline helpers and status types
- `types.ts` — shared TypeScript contracts (SessionRecord, NoteOutput, etc.)

## Patterns
- All clients are singletons — never instantiate inside a request handler
- All functions return typed results — no `any`, no untyped promises
- No business logic in utility functions — pure transformation and I/O only
- Error handling: return `{ data, error }` tuples, never throw across module boundary

## Typed Contract Pattern
```ts
type Result<T> = { data: T; error: null } | { data: null; error: string }
```

## Supabase Usage Rules
- Server-side only — never import supabase client in components or hooks
- Use service role ONLY for admin operations explicitly marked in DECISIONS.md
- Row-level security is the first line of defense — lib is second

## Redis Usage Rules
- TTL must be set on every key — no indefinite storage
- Key format: `{resource}:{id}:{descriptor}` e.g. `session:abc123:rate_limit`
- Upstash free tier limits apply — batch where possible

## EDIT_OK Gate
Do not modify any file in this directory without explicit EDIT_OK from Brian.
Changes to client initialization or auth helpers require DECISIONS.md review first.
