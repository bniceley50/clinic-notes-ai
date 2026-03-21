import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/lib/security/headers";

describe("security headers", () => {
  it("adds hardened headers for production without disabling microphone access", () => {
    const headers = buildSecurityHeaders({ isProduction: true });
    const headerMap = new Map(headers.map((header) => [header.key, header.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Permissions-Policy")).toBe(
      "camera=(), geolocation=(), microphone=(self)",
    );
    expect(headerMap.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });

  it("keeps the production CSP strict while allowing app dependencies", () => {
    const csp = buildContentSecurityPolicy({ isProduction: true });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co");
    expect(csp).toContain("https://*.ingest.sentry.io");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("allows unsafe-eval only outside production to avoid breaking local Next development", () => {
    const csp = buildContentSecurityPolicy({ isProduction: false });

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });
});
