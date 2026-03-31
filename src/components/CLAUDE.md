# src/components/ — Module Context

## Purpose
All React UI components for Clinic Notes AI. This layer renders and handles
user interaction only. No direct API calls, no Supabase imports, no server logic.

## Patterns
- Functional components with hooks only — no class components
- All props explicitly typed — no implicit `any`
- Data fetching via hooks in `src/hooks/` — never fetch directly in components
- Tailwind CSS for all styling — no inline style objects
- Accessible by default — labels, aria attributes, keyboard nav where applicable

## Component Categories
- `ui/` — primitive components (buttons, inputs, modals, cards)
- `sessions/` — session list, session detail, session controls
- `notes/` — note display, structured output rendering
- `audio/` — audio playback, recording controls
- `layout/` — shell, nav, page wrappers

## Rules
- Components do NOT import from `src/lib/` directly
- Components do NOT call `fetch()` or Supabase directly
- Side effects belong in hooks, not components
- Keep components small — if it needs >150 lines, split it

## State Pattern
Local UI state: `useState`
Server data: custom hooks from `src/hooks/`
Global app state: context only if justified in DECISIONS.md

## EDIT_OK Gate
Do not modify any file in this directory without explicit EDIT_OK from Brian.
UI-only changes (copy, color, layout) are lower risk but still require EDIT_OK.
