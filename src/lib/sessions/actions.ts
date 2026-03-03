"use server";

/**
 * Server actions for session management.
 *
 * These are called from client components via React server actions.
 * Each action resolves the current user from the loader and
 * sets org_id/created_by from the authenticated context.
 */

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/loader";
import { createSession } from "./queries";

export async function createSessionAction(formData: FormData) {
  const user = await requireAppUser();

  const rawLabel = formData.get("patient_label");
  const patientLabel =
    typeof rawLabel === "string" ? rawLabel.trim() : "";

  if (!patientLabel) {
    throw new Error("Patient label is required");
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
    throw new Error(error ?? "Failed to create session");
  }

  redirect(`/sessions/${data.id}`);
}
