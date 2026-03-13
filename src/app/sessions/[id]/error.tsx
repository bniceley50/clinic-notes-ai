"use client";

import { useEffect } from "react";
import { captureException } from "@sentry/nextjs";

export default function SessionDetailError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">Session unavailable</h2>
      <p className="max-w-md text-sm text-neutral-500">
        We hit an unexpected error while loading this session. Please try again.
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