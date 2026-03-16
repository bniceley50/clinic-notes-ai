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

export const NOT_RECORDED_CONSENT_STATUS: ConsentStatus = {
  state: "not_recorded",
};

export function deriveConsentStatus(
  consentRecord: ConsentRecord,
): ConsentStatus {
  if (!consentRecord?.hipaa_consent) {
    return NOT_RECORDED_CONSENT_STATUS;
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

export function isConsentDeclined(status: ConsentStatus): boolean {
  return status.state === "declined";
}

export function getConsentRecordedAt(status: ConsentStatus): string | null {
  return status.state === "recorded" ? status.recordedAt : null;
}

export function getConsentLabel(status: ConsentStatus): string {
  if (status.state === "recorded") {
    return status.type === "hipaa_42cfr"
      ? "HIPAA + 42 CFR Part 2 consent recorded"
      : "Consent recorded";
  }

  if (status.state === "declined") {
    return "Consent declined";
  }

  return "Consent not yet recorded";
}
