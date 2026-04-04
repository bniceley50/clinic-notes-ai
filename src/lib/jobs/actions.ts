"use server";

/**
 * Server actions for job management.
 *
 * org_id and created_by are derived from the authenticated context.
 * Only session_id and note_type come from input; session_id is
 * validated by an ownership check before createJob runs.
 */

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/loader";
import { getMySession } from "@/lib/sessions/queries";
import { createJob } from "./queries";

export type JobActionResult = { error: string | null };

const VALID_NOTE_TYPES = [
  "soap",
  "dap",
  "birp",
  "girp",
  "intake",
  "progress",
] as const;

type NoteType = (typeof VALID_NOTE_TYPES)[number];

export async function createJobAction(
  _prev: JobActionResult,
  formData: FormData,
): Promise<JobActionResult> {
  const user = await requireAppUser();

  const sessionId = formData.get("session_id");
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return { error: "Session ID is required" };
  }

  const rawNoteType = formData.get("note_type");
  const noteType: NoteType =
    typeof rawNoteType === "string" &&
    VALID_NOTE_TYPES.includes(rawNoteType as NoteType)
      ? (rawNoteType as NoteType)
      : "soap";

  const session = await getMySession(user, sessionId.trim());
  if (session.error || !session.data) {
    return { error: "Session not found or access denied." };
  }

  const { data, error } = await createJob(user, {
    session_id: sessionId.trim(),
    note_type: noteType,
  });

  if (error || !data) {
    return { error: error ?? "Failed to create job" };
  }

  redirect(`/sessions/${sessionId.trim()}`);
}
