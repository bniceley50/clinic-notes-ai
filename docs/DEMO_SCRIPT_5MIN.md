# Clinic Notes AI - 5 Minute Demo Script

## Goal

Show that this is a real AI SaaS with production-minded engineering, not just a toy feature demo.

## Setup checklist (before recording)

- App running locally or deployed.
- Test user account available.
- One sample session with completed transcript.
- One sample session showing job history/cancellation.

## Script (time-boxed)

### 0:00-0:30 - Problem + value

"Clinic Notes AI helps small clinics turn session audio into structured documentation.  
Instead of writing notes from scratch, clinicians record or upload audio and get transcript-first clinical output quickly."

### 0:30-1:15 - Show sessions + create flow

- Open sessions list.
- Create a new session.
- Enter session detail page.
- Point out consent gate and job capture section.

### 1:15-2:00 - Show audio to transcript workflow

- Start transcript job.
- Show record/upload options.
- Show job status progression and history.
- Open completed transcript view.

### 2:00-2:40 - Show structured extraction + optional notes

- Show EHR field extraction panel.
- Show optional draft note generation path.
- Mention editable/review flow and export path.

### 2:40-3:30 - Show engineering depth

Call out architecture briefly:
- Next.js + TypeScript frontend/backend routes.
- Supabase for auth, DB, storage, RLS.
- OpenAI Whisper + Anthropic Claude integration.
- Background job runner for async processing.

### 3:30-4:20 - Show reliability/security depth

Mention:
- rate limiting,
- signed uploads,
- audit logs,
- CSP hardening,
- automated test gates.

### 4:20-5:00 - Close with outcomes + roadmap

"This project demonstrates end-to-end product ownership: user workflow design, AI integration, backend reliability, and production debugging.  
Next steps are deeper E2E CI coverage and continued observability hardening."

## Optional terminal close (10 seconds)

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Then say:
"I keep this project merge-gated by linting, type checks, and automated tests."
