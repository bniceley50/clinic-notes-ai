# Lessons Log
_Updated by agent after each user correction. Read at session start._

---
### 2026-03-07 — buildStubNote failed on uppercase note types
**Pattern:** resolveSupportedNoteType() matched against lowercase keys 
but callers passed uppercase ('DAP', 'SOAP'). Silent fallback to soap template.
**Rule:** Always normalize string inputs to lowercase at the boundary 
of any key lookup. Never assume call-site casing.
### 2026-03-07 — buildStubNote interface changed, tests written against old signature
**Pattern:** Unit tests written against stub function before reading its 
current type signature. Tests used string arg; function expected TranscriptSeed object.
**Rule:** Always read the current function signature before writing tests 
against it. Never assume a stub interface matches its original spec.
### 2026-03-07 — Supabase CLI tar extraction corrupted project files
**Pattern:** tar -xzf supabase.tar.gz run from repo root extracted 
Supabase CLI README.md and LICENSE over project files.
**Rule:** Always extract CLI tools to a temp directory outside the repo.
Never run tar extraction from inside the project root.
Add supabase.exe, supabase.tar.gz, *.tar.gz to .gitignore immediately 
after any manual download.

## 2026-03-08

- Supabase magic link redirected to localhost because 
  Site URL and Redirect URLs were not set in Supabase 
  Auth -> URL Configuration
  Rule: always set Site URL and Redirect URLs in 
  Supabase before first production deploy

- ALLOW_DEV_LOGIN env var was invisible to client 
  component because it lacked NEXT_PUBLIC_ prefix
  Rule: client components can only read env vars 
  prefixed with NEXT_PUBLIC_

- Email rate limit hit during auth debugging - 
  Supabase free tier limits magic link sends per hour
  Rule: test auth flow once, not repeatedly; use 
  dev-login bypass for iterative testing
