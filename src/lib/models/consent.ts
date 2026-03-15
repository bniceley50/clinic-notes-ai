export type ConsentRecord = {
  hipaa_consent: boolean;
  part2_applicable: boolean;
  part2_consent: boolean | null;
  created_at: string;
} | null;

export type ConsentStatus =
  | { state: "not_recorded" }
  | {
      state: "recorded";
      recordedAt: string;
      type: "standard" | "hipaa_42cfr";
    }
  | { state: "declined"; declinedAt: string };

export function deriveConsentStatus(
  consentRecord: ConsentRecord,
): ConsentStatus {
  if (!consentRecord?.hipaa_consent) {
    return { state: "not_recorded" };
  }

  return {
    state: "recorded",
    recordedAt: consentRecord.created_at,
    type:
      consentRecord.part2_applicable && consentRecord.part2_consent
        ? "hipaa_42cfr"
        : "standard",
  };
}

export function deriveDeclinedConsentStatus(
  declinedAt: string = new Date().toISOString(),
): ConsentStatus {
  return { state: "declined", declinedAt };
}

export function shouldShowConsentPrompt(status: ConsentStatus): boolean {
  return status.state === "not_recorded";
}

export function shouldAllowJobStart(status: ConsentStatus): boolean {
  return status.state === "recorded";
}

export function shouldShowConsentStatus(status: ConsentStatus): boolean {
  return status.state === "recorded" || status.state === "declined";
}
