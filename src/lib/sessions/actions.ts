"use server";

/**
 * Server actions for session management.
 *
 * These are called from client components via React server actions.
 * Each action resolves the current user from the loader and
 * sets org_id/created_by from the authenticated context.
 *
 * Returns { error: string } on validation/DB failure so the UI
 * can render a usable message instead of an uncaught crash.
 */

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/loader";
import { ErrorCodes } from "@/lib/errors/codes";
import { logError } from "@/lib/logger";
import { CreateSessionSchema } from "@/lib/validation/note-validation";
import { createSession } from "./queries";

export type ActionResult = { error: string | null };

export async function createSessionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAppUser();

  const parsed = CreateSessionSchema.safeParse({
    patient_label: formData.get("patient_label"),
    session_type: formData.get("session_type"),
  });
  if (!parsed.success) {
    logError({
      code: ErrorCodes.VALIDATION_ERROR,
      cause: parsed.error,
      message: "createSessionAction validation failed",
      userId: user.userId,
    });
    return { error: "Invalid request." };
  }

  const { data, error } = await createSession(user, {
    patient_label: parsed.data.patient_label,
    session_type: parsed.data.session_type,
  });

  if (error || !data) {
    return { error: error ?? "Failed to create session" };
  }

  redirect(`/sessions/${data.id}`);
}
