import { describe, expect, it } from "vitest";
import {
  deriveConsentStatus,
  deriveDeclinedConsentStatus,
  getConsentLabel,
  getConsentRecordedAt,
  isConsentDeclined,
  NOT_RECORDED_CONSENT_STATUS,
  shouldAllowJobStart,
  shouldShowConsentPrompt,
  shouldShowConsentStatus,
} from "@/lib/models/consent";

describe("deriveConsentStatus", () => {
  it("returns not_recorded when no consent record exists", () => {
    expect(deriveConsentStatus(null)).toEqual(NOT_RECORDED_CONSENT_STATUS);
  });

  it("returns recorded with standard metadata when HIPAA consent exists", () => {
    expect(
      deriveConsentStatus({
        hipaa_consent: true,
        part2_applicable: false,
        part2_consent: null,
        created_at: "2026-03-15T12:00:00.000Z",
      }),
    ).toEqual({
      state: "recorded",
      recordedAt: "2026-03-15T12:00:00.000Z",
      type: "standard",
    });
  });

  it("returns recorded with hipaa_42cfr metadata when Part 2 consent exists", () => {
    expect(
      deriveConsentStatus({
        hipaa_consent: true,
        part2_applicable: true,
        part2_consent: true,
        created_at: "2026-03-15T12:00:00.000Z",
      }),
    ).toEqual({
      state: "recorded",
      recordedAt: "2026-03-15T12:00:00.000Z",
      type: "hipaa_42cfr",
    });
  });
});

describe("shouldShowConsentPrompt", () => {
  it("returns true when consent is not recorded", () => {
    expect(shouldShowConsentPrompt({ state: "not_recorded" })).toBe(true);
  });

  it("returns false when consent is recorded", () => {
    expect(
      shouldShowConsentPrompt({
        state: "recorded",
        recordedAt: "2026-03-15T12:00:00.000Z",
        type: "standard",
      }),
    ).toBe(false);
  });

  it("returns false when consent is declined", () => {
    expect(
      shouldShowConsentPrompt(deriveDeclinedConsentStatus("2026-03-15T12:00:00.000Z")),
    ).toBe(false);
  });
});

describe("shouldAllowJobStart", () => {
  it("returns true only when consent is recorded", () => {
    expect(
      shouldAllowJobStart({
        state: "recorded",
        recordedAt: "2026-03-15T12:00:00.000Z",
        type: "standard",
      }),
    ).toBe(true);
  });

  it("returns false when consent is not recorded", () => {
    expect(shouldAllowJobStart({ state: "not_recorded" })).toBe(false);
  });

  it("returns false when consent is declined", () => {
    expect(
      shouldAllowJobStart(
        deriveDeclinedConsentStatus("2026-03-15T12:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("shouldShowConsentStatus", () => {
  it("returns true when consent is recorded", () => {
    expect(
      shouldShowConsentStatus({
        state: "recorded",
        recordedAt: "2026-03-15T12:00:00.000Z",
        type: "standard",
      }),
    ).toBe(true);
  });

  it("returns true when consent is declined", () => {
    expect(
      shouldShowConsentStatus(
        deriveDeclinedConsentStatus("2026-03-15T12:00:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("consent metadata helpers", () => {
  it("returns the recorded timestamp only for recorded consent", () => {
    expect(
      getConsentRecordedAt({
        state: "recorded",
        recordedAt: "2026-03-15T12:00:00.000Z",
        type: "standard",
      }),
    ).toBe("2026-03-15T12:00:00.000Z");
    expect(getConsentRecordedAt(NOT_RECORDED_CONSENT_STATUS)).toBeNull();
  });

  it("returns a label for each consent state", () => {
    expect(getConsentLabel(NOT_RECORDED_CONSENT_STATUS)).toBe(
      "Consent not yet recorded",
    );
    expect(
      getConsentLabel({
        state: "recorded",
        recordedAt: "2026-03-15T12:00:00.000Z",
        type: "hipaa_42cfr",
      }),
    ).toBe("HIPAA + 42 CFR Part 2 consent recorded");
    expect(
      getConsentLabel(
        deriveDeclinedConsentStatus("2026-03-15T12:00:00.000Z"),
      ),
    ).toBe("Consent declined");
  });

  it("detects declined consent explicitly", () => {
    expect(
      isConsentDeclined(
        deriveDeclinedConsentStatus("2026-03-15T12:00:00.000Z"),
      ),
    ).toBe(true);
    expect(isConsentDeclined(NOT_RECORDED_CONSENT_STATUS)).toBe(false);
  });
});
