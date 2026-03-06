"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type HeaderProps = {
  displayName?: string;
  orgName?: string;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sessions", label: "Sessions" },
  { href: "/schedule", label: "Schedule" },
  { href: "/reports", label: "Reports" },
];

export function Header({ displayName, orgName }: HeaderProps) {
  const pathname = usePathname();

  return (
    <>
      <header className="ql-app-header">
        <div className="ql-app-header-inner">
          <div className="ql-brand">CLINIC NOTES AI</div>
          <div className="ql-header-meta">
            {orgName && <span>{orgName}</span>}
            {displayName && <span>{displayName}</span>}
            <span>AI-GENERATED - REVIEW REQUIRED</span>
          </div>
        </div>
      </header>

      <nav className="ql-nav" aria-label="Primary">
        <div className="ql-nav-inner">
          <div className="ql-nav-links">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("ql-nav-link", active && "is-active")}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="ql-button-secondary">
              Sign Out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
