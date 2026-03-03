# Architecture — Clinic Notes AI

> TODO: Expand as features are built. Target: 1-2 pages max.

## Data Flow

```
Audio Upload -> Supabase Storage (audio bucket)
     |
     v
Job Created -> jobs table (status: queued)
     |
     v
Whisper API -> Transcript -> Supabase Storage (transcripts bucket)
     |                       transcripts table
     v
Claude API -> Draft Note -> Supabase Storage (drafts bucket)
     |                      notes table
     v
Clinician Review -> Edit Note -> Export (.docx / clipboard)
```

## Key Components

- **Dashboard shell** — Sidebar + header, authenticated layout
- **Session workspace** — 4-panel: audio input, transcript, note viewer, note editor
- **Job pipeline** — Server-side orchestration: transcribe -> draft -> export

## Milestones

See `PLAN.md` for full milestone breakdown.
