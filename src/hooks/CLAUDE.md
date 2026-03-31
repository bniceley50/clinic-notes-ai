# src/hooks/ — Module Context

## Purpose
Custom React hooks that encapsulate data fetching, state management, and
side effects for Clinic Notes AI UI. The bridge between components and the API layer.

## Patterns
- One concern per hook — `useSession`, `useTranscript`, `useJobStatus` not `useEverything`
- All hooks return typed objects — never untyped or `any`
- Loading, error, and data states always returned together
- Mutations return an execute function + loading/error state
- No direct Supabase imports — hooks call `/api/*` routes via fetch

## Return Shape Pattern
```ts
// Query hook
return { data: Session | null, isLoading: boolean, error: string | null }

// Mutation hook
return { execute: (args) => Promise<void>, isLoading: boolean, error: string | null }
```

## Key Hooks
- `useSession(id)` — fetch and subscribe to a single session
- `useSessions()` — fetch session list for current user
- `useJobStatus(jobId)` — poll job pipeline status with backoff
- `useAudioPlayback(url)` — audio player state and controls
- `useTranscript(sessionId)` — fetch transcript artifact

## Rules
- Hooks do NOT render anything — no JSX
- Hooks do NOT import from `src/lib/` — only `src/hooks/` and React
- Polling hooks must clean up intervals on unmount
- Never swallow errors silently — always surface to error state

## EDIT_OK Gate
Do not modify any file in this directory without explicit EDIT_OK from Brian.
