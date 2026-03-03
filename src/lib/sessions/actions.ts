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
import { createSession } from "./queries";

export type ActionResult = { error: string | null };

export async function createSessionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAppUser();

  const rawLabel = formData.get("patient_label");
  const patientLabel =
    typeof rawLabel === "string" ? rawLabel.trim() : "";

  if (!patientLabel) {
    return { error: "Patient label is required" };
  }

  const sessionType = formData.get("session_type");
  const validTypes = ["intake", "follow-up", "general"] as const;
  const type =
    typeof sessionType === "string" &&
    validTypes.includes(sessionType as (typeof validTypes)[number])
      ? (sessionType as (typeof validTypes)[number])
      : "general";

  const { data, error } = await createSession(user, {
    patient_label: patientLabel,
    session_type: type,
  });

  if (error || !data) {
    return { error: error ?? "Failed to create session" };
  }

  redirect(`/sessions/${data.id}`);
}
