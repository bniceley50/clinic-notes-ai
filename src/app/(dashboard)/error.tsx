"use client";

import { useEffect } from "react";
import { captureException } from "@sentry/nextjs";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">Dashboard unavailable</h2>
      <p className="max-w-md text-sm text-neutral-500">
        We hit an unexpected error while loading this workspace. Please try again.
      </p>
      <button
        onClick={reset}
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Try again
      </button>
    </div>
  );
}