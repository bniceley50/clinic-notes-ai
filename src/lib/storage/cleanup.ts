/**
 * Artifact cleanup for soft-deleted sessions.
 *
 * Production path: cleanupSoftDeletedArtifactsGlobally()
 *   Finds jobs soft-deleted longer than the configured TTL and removes
 *   their storage objects. Does NOT hard-delete any patient-related rows.
 *   See DECISIONS.md D008 and D013.
 *
 * Test path: purgeTestSoftDeletedDataGlobally()
 *   Removes storage objects AND hard-deletes all soft-deleted rows.
 *   Requires ALLOW_TEST_PURGE=1. Never call in production.
 */

import "server-only";

import { jobTtlSeconds } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/server";

const AUDIO_BUCKET = "audio";
const TRANSCRIPTS_BUCKET = process.env.TRANSCRIPT_BUCKET ?? "transcripts";
const DRAFTS_BUCKET = "drafts";

type ArtifactRow = {
  id: string;
  session_id: string;
  org_id: string;
  audio_storage_path: string | null;
  transcript_storage_path: string | null;
  draft_storage_path: string | null;
};

type SessionIdRow = {
  id: string;
};

const ARTIFACT_COLUMNS =
  "id, session_id, org_id, audio_storage_path, transcript_storage_path, draft_storage_path";

/**
 * Strips a bucket-name prefix from a storage path if present.
 * Handles legacy stub-generated paths like "audio/org/session/job/recording.webm"
 * as well as canonical bucket-relative paths like "org/session/job/recording.webm".
 */
function toBucketRelativePath(bucket: string, storagePath: string): string {
  const prefix = `${bucket}/`;
  return storagePath.startsWith(prefix)
    ? storagePath.slice(prefix.length)
    : storagePath;
}

function uniqueNormalizedPaths(
  bucket: string,
  values: Array<string | null>,
): string[] {
  return [...new Set(
    values
      .filter((value): value is string => Boolean(value))
      .map((value) => toBucketRelativePath(bucket, value)),
  )];
}

async function removeArtifacts(rows: ArtifactRow[]): Promise<void> {
  const db = createServiceClient();

  const audioPaths = uniqueNormalizedPaths(
    AUDIO_BUCKET,
    rows.map((row) => row.audio_storage_path),
  );
  const transcriptPaths = uniqueNormalizedPaths(
    TRANSCRIPTS_BUCKET,
    rows.map((row) => row.transcript_storage_path),
  );
  const draftPaths = uniqueNormalizedPaths(
    DRAFTS_BUCKET,
    rows.map((row) => row.draft_storage_path),
  );

  if (audioPaths.length > 0) {
    const { error } = await db.storage.from(AUDIO_BUCKET).remove(audioPaths);
    if (error) throw new Error(`Audio artifact cleanup failed: ${error.message}`);
  }

  if (transcriptPaths.length > 0) {
    const { error } = await db.storage
      .from(TRANSCRIPTS_BUCKET)
      .remove(transcriptPaths);
    if (error) {
      throw new Error(`Transcript artifact cleanup failed: ${error.message}`);
    }
  }

  if (draftPaths.length > 0) {
    const { error } = await db.storage.from(DRAFTS_BUCKET).remove(draftPaths);
    if (error) throw new Error(`Draft artifact cleanup failed: ${error.message}`);
  }
}

async function clearArtifactPaths(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;

  const db = createServiceClient();
  const { error } = await db
    .from("jobs")
    .update({
      audio_storage_path: null,
      transcript_storage_path: null,
      draft_storage_path: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", jobIds)
    .not("deleted_at", "is", null);

  if (error) {
    throw new Error(`Failed to clear cleaned artifact paths: ${error.message}`);
  }
}

/**
 * Explicit global production TTL cleaner.
 *
 * Finds soft-deleted jobs older than JOB_TTL_SECONDS and removes their
 * storage artifacts. No patient-related rows are hard-deleted.
 */
export async function cleanupSoftDeletedArtifactsGlobally(): Promise<{
  cleaned: number;
  error: string | null;
}> {
  const db = createServiceClient();
  const cutoff = new Date(Date.now() - jobTtlSeconds() * 1000).toISOString();

  const { data, error } = await db
    .from("jobs")
    .select(ARTIFACT_COLUMNS)
    .not("deleted_at", "is", null)
    .lte("deleted_at", cutoff)
    .or(
      "audio_storage_path.not.is.null,transcript_storage_path.not.is.null,draft_storage_path.not.is.null",
    );

  if (error) {
    return {
      cleaned: 0,
      error: `Failed to query soft-deleted jobs: ${error.message}`,
    };
  }

  const rows = (data ?? []) as ArtifactRow[];
  if (rows.length === 0) {
    return { cleaned: 0, error: null };
  }

  try {
    await removeArtifacts(rows);
    await clearArtifactPaths(rows.map((row) => row.id));
  } catch (err) {
    return {
      cleaned: 0,
      error: err instanceof Error ? err.message : "Artifact cleanup failed",
    };
  }

  return { cleaned: rows.length, error: null };
}

/**
 * Explicit global test-only purge.
 *
 * Removes storage artifacts AND hard-deletes all soft-deleted rows
 * across patient-related tables. Bypasses the TTL age check.
 *
 * Requires ALLOW_TEST_PURGE=1. Never call this in production.
 */
export async function purgeTestSoftDeletedDataGlobally(): Promise<{
  purged: number;
  error: string | null;
}> {
  if (process.env.ALLOW_TEST_PURGE !== "1") {
    throw new Error(
      "purgeTestSoftDeletedDataGlobally() requires ALLOW_TEST_PURGE=1. Never call this in production.",
    );
  }

  const db = createServiceClient();

  const { data: sessionData, error: sessionError } = await db
    .from("sessions")
    .select("id")
    .not("deleted_at", "is", null);

  if (sessionError) {
    return {
      purged: 0,
      error: `Failed to query soft-deleted sessions: ${sessionError.message}`,
    };
  }

  const sessionIds = ((sessionData ?? []) as SessionIdRow[]).map((row) => row.id);
  if (sessionIds.length === 0) {
    return { purged: 0, error: null };
  }

  const { data: jobData, error: jobError } = await db
    .from("jobs")
    .select(ARTIFACT_COLUMNS)
    .in("session_id", sessionIds)
    .not("deleted_at", "is", null);

  if (jobError) {
    return {
      purged: 0,
      error: `Failed to query soft-deleted jobs: ${jobError.message}`,
    };
  }

  const rows = (jobData ?? []) as ArtifactRow[];

  if (rows.length > 0) {
    try {
      await removeArtifacts(rows);
    } catch (err) {
      return {
        purged: 0,
        error: err instanceof Error ? err.message : "Artifact removal failed",
      };
    }
  }

  const childTables = [
    "notes",
    "transcripts",
    "carelogic_field_extractions",
    "jobs",
    "session_consents",
  ];

  for (const table of childTables) {
    const { error: deleteError } = await db
      .from(table)
      .delete()
      .in("session_id", sessionIds)
      .not("deleted_at", "is", null);

    if (deleteError) {
      return {
        purged: 0,
        error: `Failed to hard-delete ${table}: ${deleteError.message}`,
      };
    }
  }

  const { error: sessionDeleteError } = await db
    .from("sessions")
    .delete()
    .in("id", sessionIds)
    .not("deleted_at", "is", null);

  if (sessionDeleteError) {
    return {
      purged: 0,
      error: `Failed to hard-delete sessions: ${sessionDeleteError.message}`,
    };
  }

  return { purged: sessionIds.length, error: null };
}
