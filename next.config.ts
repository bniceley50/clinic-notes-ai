import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { buildNonCspSecurityHeaders } from "./src/lib/security/headers";

// CSP is intentionally absent from static headers.
// It is now emitted per-request by middleware with a nonce value.
// See DECISIONS.md D015.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildNonCspSecurityHeaders({
          isProduction: process.env.NODE_ENV === "production",
        }),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  // TEMPORARY: disableLogger removed to allow Sentry debug output in runtime logs.
  // Restore logger stripping after transport diagnostics are complete.
});
