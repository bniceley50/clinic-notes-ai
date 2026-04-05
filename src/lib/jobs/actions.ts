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
import { ErrorCodes } from "@/lib/errors/codes";
import { logError } from "@/lib/logger";
import { getMySession } from "@/lib/sessions/queries";
import { CreateJobSchema } from "@/lib/validation/note-validation";
import { createJob, type JobNoteType } from "./queries";

export type JobActionResult = { error: string | null };

export async function createJobAction(
  _prev: JobActionResult,
  formData: FormData,
): Promise<JobActionResult> {
  const user = await requireAppUser();

  const parsed = CreateJobSchema.safeParse({
    session_id: formData.get("session_id"),
    note_type: formData.get("note_type"),
  });
  if (!parsed.success) {
    logError({
      code: ErrorCodes.VALIDATION_ERROR,
      cause: parsed.error,
      message: "createJobAction validation failed",
      userId: user.userId,
    });
    return { error: "Invalid request." };
  }

  const sessionId = parsed.data.session_id;
  const noteType = parsed.data.note_type as JobNoteType;

  const session = await getMySession(user, sessionId);
  if (session.error || !session.data) {
    return { error: "Session not found or access denied." };
  }

  const { data, error } = await createJob(user, {
    session_id: sessionId,
    note_type: noteType,
  });

  if (error || !data) {
    return { error: error ?? "Failed to create job" };
  }

  redirect(`/sessions/${sessionId}`);
}
