import { describe, expect, it } from "vitest";

describe("set-password page", () => {
  it("forces dynamic rendering for nonce-based CSP", async () => {
    const pageModule = await import("@/app/set-password/page");

    expect(pageModule.dynamic).toBe("force-dynamic");
  });
});
