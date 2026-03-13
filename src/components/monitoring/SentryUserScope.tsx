"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

type Props = {
  userId?: string;
};

export function SentryUserScope({ userId }: Props) {
  useEffect(() => {
    if (userId) {
      Sentry.setUser({ id: userId });
      return;
    }

    Sentry.setUser(null);
  }, [userId]);

  return null;
}