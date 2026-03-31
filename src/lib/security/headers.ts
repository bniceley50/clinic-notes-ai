type SecurityHeader = {
  key: string;
  value: string;
};

type SecurityHeadersOptions = {
  isProduction?: boolean;
  nonce?: string;
};

const SUPABASE_ORIGINS = [
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://*.supabase.in",
  "wss://*.supabase.in",
];

const SENTRY_INGEST_ORIGINS = [
  "https://*.ingest.sentry.io",
  "https://*.ingest.us.sentry.io",
];

function joinSources(values: string[]): string {
  return [...new Set(values)].join(" ");
}

export function buildContentSecurityPolicy({
  isProduction = false,
  nonce,
}: SecurityHeadersOptions = {}): string {
  // Nonce-based script-src: replaces 'unsafe-inline' per D015.
  // When nonce is present (middleware path), inline scripts are locked to
  // framework-generated tags carrying that nonce value.
  // 'unsafe-inline' is intentionally absent from this branch.
  const scriptSrc = nonce
    ? ["'self'", `'nonce-${nonce}'`]
    : ["'self'", "'unsafe-inline'"]; // fallback only — should not reach production

  // Keep 'unsafe-eval' in development for Next.js HMR.
  if (!isProduction) {
    scriptSrc.push("'unsafe-eval'");
  }

  // style-src retains 'unsafe-inline' as a deliberate temporary tradeoff.
  // The UI uses many inline React style={...} props (e.g. layout.tsx, LoginPageClient.tsx).
  // This is not incomplete work — see DECISIONS.md D015 before changing.
  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `font-src 'self' data:`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `img-src ${joinSources([
      "'self'",
      "data:",
      "blob:",
      ...SUPABASE_ORIGINS.filter((origin) => origin.startsWith("https://")),
    ])}`,
    `media-src ${joinSources([
      "'self'",
      "blob:",
      "data:",
      ...SUPABASE_ORIGINS.filter((origin) => origin.startsWith("https://")),
    ])}`,
    `object-src 'none'`,
    `script-src ${joinSources(scriptSrc)}`,
    `style-src 'self' 'unsafe-inline'`,
    `connect-src ${joinSources([
      "'self'",
      ...SUPABASE_ORIGINS,
      ...SENTRY_INGEST_ORIGINS,
    ])}`,
    `worker-src 'self' blob:`,
  ];

  return directives.join("; ");
}

/**
 * All security headers except Content-Security-Policy.
 * Used by next.config.ts for static header emission.
 * CSP is now request-scoped and emitted by middleware with a per-request nonce.
 * See DECISIONS.md D015.
 */
export function buildNonCspSecurityHeaders({
  isProduction = false,
}: SecurityHeadersOptions = {}): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Origin-Agent-Cluster", value: "?1" },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

/**
 * Full security headers including CSP.
 * Retained for non-middleware contexts and tests.
 * next.config.ts should use buildNonCspSecurityHeaders instead.
 */
export function buildSecurityHeaders({
  isProduction = false,
  nonce,
}: SecurityHeadersOptions = {}): SecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({ isProduction, nonce }),
    },
    ...buildNonCspSecurityHeaders({ isProduction }),
  ];
}
