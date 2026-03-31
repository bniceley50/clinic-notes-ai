import React from "react";
import Link from "next/link";

/**
 * Footer — site-wide footer with LLC attribution and legal links.
 * Used in AppShell (authenticated pages) and public pages (login, set-password).
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="w-full border-t px-6 py-4"
      style={{
        backgroundColor: "#F9F9F9",
        borderColor: "#E7E9EC",
      }}
    >
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <p className="text-[11px] text-text-muted">
          &copy; {year} Niceley AI Consulting LLC. All rights reserved.
        </p>
        <nav className="flex items-center gap-4">
          <Link
            href="/terms"
            className="text-[11px] no-underline transition-colors text-text-muted"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="text-[11px] no-underline transition-colors text-text-muted"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
