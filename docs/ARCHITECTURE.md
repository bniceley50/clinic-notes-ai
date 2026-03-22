# Architecture — Clinic Notes AI

## Data Flow

```
Session created
     |
     v
Job created -> jobs table (status: queued)
     |
     v
Audio uploaded -> Supabase Storage (audio bucket)
     |
     v
Client trigger route -> POST /api/jobs/[id]/trigger
     |
     v
Trigger route calls deployed app -> POST /api/jobs/[id]/process
     |
     v
processJob() claims the queued row via claim/lease RPC
     |
     v
Whisper transcription -> transcript row + transcript artifact
     |
     v
Job marked complete after transcription
     |
     +--> Optional EHR field extraction -> Anthropic call -> carelogic_field_extractions
     |
     +--> Optional note generation -> Anthropic call -> notes table
     |
     v
Clinician review/edit -> export (.docx / clipboard)
```

## Key Components

- **Dashboard shell** — authenticated app chrome and session navigation
- **Session workspace** — transcript-first workflow with audio, transcript, EHR fields, and optional note tools
- **Job pipeline** — database-backed job state with claim/lease semantics and a Vercel route-based processor
- **Runner route** — requeues expired running leases and dispatches queued jobs by calling the app's own `/api/jobs/[id]/process` route

## Runtime Notes

- The default pipeline is transcript-first. Jobs complete after transcription.
- Note generation is no longer part of the default job pipeline. It remains an optional follow-up action.
- Structured EHR extraction is generated from the transcript and stored in `carelogic_field_extractions`.
- The current executor is still HTTP self-calling on Vercel:
  - `/api/jobs/[id]/trigger` calls the deployed app's `/api/jobs/[id]/process`
  - `/api/jobs/runner` also calls the deployed app's `/api/jobs/[id]/process` for queued jobs
- Session deletion is a hard cascade delete of related rows and storage artifacts, not a soft delete flow.

## Milestones

See `PLAN.md` for full milestone breakdown.
