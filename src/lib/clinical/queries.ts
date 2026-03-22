import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/loader";
import type { JobNoteType } from "@/lib/jobs/queries";

export type TranscriptRow = {
  id: string;
  session_id: string;
  org_id: string;
  job_id: string;
  content: string;
  duration_seconds: number | null;
  word_count: number | null;
  created_at: string;
};

export type NoteRow = {
  id: string;
  session_id: string;
  org_id: string;
  job_id: string | null;
  content: string;
  note_type: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ExtractionRow = {
  id: string;
  session_id: string;
  org_id: string;
  job_id: string;
  transcript_id: string;
  session_type: string;
  fields: Record<string, string>;
  generated_by: string;
  generated_at: string;
  updated_at: string;
};

const TRANSCRIPT_COLUMNS =
  "id, session_id, org_id, job_id, content, duration_seconds, word_count, created_at";

const NOTE_COLUMNS =
  "id, session_id, org_id, job_id, content, note_type, status, created_by, created_at, updated_at";

const EXTRACTION_COLUMNS =
  "id, session_id, org_id, job_id, transcript_id, session_type, fields, generated_by, generated_at, updated_at";

export async function upsertTranscriptForJob(input: {
  sessionId: string;
  orgId: string;
  jobId: string;
  content: string;
  durationSeconds: number;
  wordCount: number;
}): Promise<{ data: TranscriptRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("transcripts")
    .upsert(
      {
        session_id: input.sessionId,
        org_id: input.orgId,
        job_id: input.jobId,
        content: input.content,
        duration_seconds: input.durationSeconds,
        word_count: input.wordCount,
      },
      {
        onConflict: "job_id",
      },
    )
    .select(TRANSCRIPT_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as TranscriptRow, error: null };
}

export async function upsertNoteForJob(input: {
  sessionId: string;
  orgId: string;
  jobId: string;
  createdBy: string;
  noteType: JobNoteType;
  content: string;
}): Promise<{ data: NoteRow | null; error: string | null }> {
  const db = createServiceClient();

  const existing = await db
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("job_id", input.jobId)
    .eq("session_id", input.sessionId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (existing.error) {
    return { data: null, error: existing.error.message };
  }

  if (existing.data) {
    const { data, error } = await db
      .from("notes")
      .update({
        content: input.content,
        note_type: input.noteType,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .select(NOTE_COLUMNS)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as NoteRow, error: null };
  }

  const { data, error } = await db
    .from("notes")
    .insert({
      session_id: input.sessionId,
      org_id: input.orgId,
      job_id: input.jobId,
      content: input.content,
      note_type: input.noteType,
      status: "draft",
      created_by: input.createdBy,
    })
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as NoteRow, error: null };
}

export async function getLatestTranscriptForSession(
  user: AppUser,
  sessionId: string,
): Promise<{ data: TranscriptRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("transcripts")
    .select(TRANSCRIPT_COLUMNS)
    .eq("session_id", sessionId)
    .eq("org_id", user.orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as TranscriptRow | null, error: null };
}

export async function getTranscriptForJob(
  user: AppUser,
  sessionId: string,
  jobId: string,
): Promise<{ data: TranscriptRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("transcripts")
    .select(TRANSCRIPT_COLUMNS)
    .eq("session_id", sessionId)
    .eq("org_id", user.orgId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as TranscriptRow | null, error: null };
}

export async function getExtractionForTranscript(
  user: AppUser,
  transcriptId: string,
): Promise<{ data: ExtractionRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("carelogic_field_extractions")
    .select(EXTRACTION_COLUMNS)
    .eq("transcript_id", transcriptId)
    .eq("org_id", user.orgId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as ExtractionRow | null, error: null };
}

export async function upsertExtraction(
  user: AppUser,
  input: {
    sessionId: string;
    jobId: string;
    transcriptId: string;
    sessionType: string;
    fields: Record<string, string>;
  },
): Promise<{ data: ExtractionRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("carelogic_field_extractions")
    .upsert(
      {
        session_id: input.sessionId,
        org_id: user.orgId,
        job_id: input.jobId,
        transcript_id: input.transcriptId,
        session_type: input.sessionType,
        fields: input.fields,
        generated_by: user.userId,
      },
      {
        onConflict: "transcript_id",
      },
    )
    .select(EXTRACTION_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as ExtractionRow, error: null };
}

export async function getLatestNoteForSession(
  user: AppUser,
  sessionId: string,
): Promise<{ data: NoteRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("session_id", sessionId)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? null) as NoteRow | null, error: null };
}

export async function getMyNote(
  user: AppUser,
  sessionId: string,
  noteId: string,
): Promise<{ data: NoteRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("id", noteId)
    .eq("session_id", sessionId)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as NoteRow, error: null };
}

export async function updateMyNoteContent(
  user: AppUser,
  sessionId: string,
  noteId: string,
  content: string,
): Promise<{ data: NoteRow | null; error: string | null }> {
  const db = createServiceClient();

  const { data, error } = await db
    .from("notes")
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("session_id", sessionId)
    .eq("org_id", user.orgId)
    .eq("created_by", user.userId)
    .select(NOTE_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as NoteRow, error: null };
}
