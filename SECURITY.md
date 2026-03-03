# Security Policy — Clinic Notes AI

## Data Classification

This application is designed to handle Protected Health Information (PHI) eventually. Until a HIPAA compliance review is complete, **only fake/test data** is permitted.

### v0 Data Rules
- Patient names: use labels only ("Patient A", "Session 2026-03-03")
- Emails: `@example.com` only
- Phone: `555-xxxx` format only
- IDs: UUID placeholders like `00000000-0000-0000-0000-000000000001`
- No real patient data in any environment until HIPAA review is complete

## Authentication

- **Method:** Supabase Auth (method TBD — decision gate at Milestone 0)
- **Session:** JWT signed with `AUTH_COOKIE_SECRET` (HS256), stored in httpOnly cookie
- **Flags:** `SameSite=Lax`, `Secure` in production
- **TTL:** 8 hours default (`SESSION_TTL_SECONDS`)
- **Dev bypass:** `ALLOW_DEV_LOGIN=1` only in `NODE_ENV=development`

## Authorization

- **RLS:** Every table has Row Level Security enabled
- **Policy:** `is_org_member(org_id)` function gates all operations
- **INSERT:** Additionally requires `created_by = auth.uid()`
- **Service role key:** Never exposed client-side, used only in server-side operations

## Secrets Management

### Never Commit
- API keys, service role keys, JWT secrets, or tokens of any kind
- Supabase URLs paired with service keys
- Database connection strings containing credentials
- Private keys or certificates
- Real names, emails, phone numbers, addresses, or any user-identifying data
- Session tokens, OAuth secrets, or webhook signing secrets

### .gitignore (enforced)
```
.env
.env.local
.env.production
.env*.local
*.pem
/supabase/.temp
```

### Environment Separation
- **Dev keys:** `.env.local` only
- **Prod keys:** `.env.production` only (Vercel environment variables)
- Never shared between environments

## AI API Security

- **Kill switch:** `AI_ENABLE_REAL_APIS` must be explicitly set to `1` for real API calls
- **Runner token:** `/api/jobs/runner` requires `JOBS_RUNNER_TOKEN` header
- **No PII in prompts:** Transcripts sent to AI APIs — PHI exposure risk. Before real PHI: requires BAA with OpenAI and Anthropic.
- **No PII in logs:** Log job IDs and status only, never transcript content

## Threat Model

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Cross-practice data leakage | RLS with `is_org_member()` on every table | Designed |
| Unauthorized API spending | Kill switch + runner token | Designed |
| Session hijacking | httpOnly + SameSite=Lax + Secure in prod | Designed |
| Service key exposure | Server-side only, never in client bundles | Designed |
| PHI in logs | Log IDs only policy | Designed |
| PHI in AI API calls | Requires BAA before real PHI | Open decision |
| Unauthenticated access | Middleware + route guards | Designed |
| Secrets in git history | .gitignore enforced from day one | Designed |

## HIPAA Compliance (Open — Decision Gate Before Real PHI)

Before any real patient data enters the system:

1. [ ] BAA with Supabase (or self-hosted alternative)
2. [ ] BAA with OpenAI (Whisper API)
3. [ ] BAA with Anthropic (Claude API)
4. [ ] Encryption at rest for Supabase Storage buckets
5. [ ] Audit logging implemented and verified
6. [ ] Access controls reviewed against HIPAA minimum necessary standard
7. [ ] Data retention and deletion policy documented
8. [ ] Incident response plan documented

## Secret Scanning

GitHub secret scanning should be evaluated at Milestone C. Not configured yet — will be flagged as a decision gate when the time comes.

## Reporting Security Issues

If you discover a security vulnerability, contact the project owner directly. Do not open a public issue.
