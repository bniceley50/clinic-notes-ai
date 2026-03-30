type SecurityHeader = {
  key: string;
  value: string;
};

type SecurityHeadersOptions = {
  isProduction?: boolean;
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
}: SecurityHeadersOptions = {}): string {
  const scriptSrc = ["'self'", "'unsafe-inline'"];

  // Keep local Next.js development functional without weakening production.
  if (!isProduction) {
    scriptSrc.push("'unsafe-eval'");
  }

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

export function buildSecurityHeaders({
  isProduction = false,
}: SecurityHeadersOptions = {}): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy({ isProduction }) },
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
