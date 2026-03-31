import * as Sentry from "@sentry/nextjs";

export async function register() {
  console.log(
    "[instrumentation] register() called, NEXT_RUNTIME=",
    process.env.NEXT_RUNTIME,
  ); // TEMPORARY

  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[instrumentation] loading sentry.server.config"); // TEMPORARY
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Required for v10 request-level server instrumentation.
export const onRequestError = Sentry.captureRequestError;
