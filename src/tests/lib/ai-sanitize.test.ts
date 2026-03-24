import { describe, expect, it } from "vitest";
import { sanitizeAiError } from "@/lib/ai/types";

describe("sanitizeAiError", () => {
  it("truncates long error messages to 200 characters", () => {
    const message = "x".repeat(250);

    expect(sanitizeAiError(new Error(message))).toBe("x".repeat(200));
  });

  it("redacts prompt content from error messages", () => {
    const sanitized = sanitizeAiError(
      new Error("Anthropic failed because prompt included transcript text here"),
    );

    expect(sanitized).toBe("Anthropic failed because [prompt content redacted]");
  });

  it("returns a generic message for non-Error values", () => {
    expect(sanitizeAiError({ error: "bad" })).toBe("AI service error");
  });

  it("passes through ordinary short messages unchanged", () => {
    expect(sanitizeAiError(new Error("Claude request timed out"))).toBe(
      "Claude request timed out",
    );
  });
});
