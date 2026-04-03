import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildNonCspSecurityHeaders,
  buildSecurityHeaders,
} from "@/lib/security/headers";

describe("security headers", () => {
  it("adds hardened headers for production without disabling microphone access", () => {
    const headers = buildNonCspSecurityHeaders({ isProduction: true });
    const headerMap = new Map(headers.map((header) => [header.key, header.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Permissions-Policy")).toBe(
      "camera=(), geolocation=(), microphone=(self)",
    );
    expect(headerMap.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headerMap.has("Content-Security-Policy")).toBe(false);
  });

  it("builds a nonce-based production CSP without unsafe-inline for scripts or styles", () => {
    const csp = buildContentSecurityPolicy({ isProduction: true, nonce: "abc123" });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co");
    expect(csp).toContain("https://*.ingest.sentry.io");
    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("allows the development-only CSP relaxations needed for local Next development", () => {
    const csp = buildContentSecurityPolicy({ isProduction: false, nonce: "abc123" });

    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("can still build the full header set with CSP for middleware-adjacent callers", () => {
    const headers = buildSecurityHeaders({ isProduction: true, nonce: "abc123" });
    const headerMap = new Map(headers.map((header) => [header.key, header.value]));

    expect(headerMap.get("Content-Security-Policy")).toContain("'nonce-abc123'");
  });
});
