"use client";

import "./globals.css";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--color-nav-bg)] text-[var(--color-text-body)]">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="card-ql w-full max-w-xl p-8">
            <h1 className="mb-3 text-2xl font-bold">Something went wrong</h1>
            <p className="mb-6 text-sm text-[var(--color-text-muted)]">
              An unexpected application error occurred. The issue has been
              captured for review.
            </p>
            <button className="btn-ql" onClick={() => reset()}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
