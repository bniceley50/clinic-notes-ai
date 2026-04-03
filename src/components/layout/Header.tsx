"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavUser = {
  displayName: string;
  orgName: string;
  role: string;
};

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Sessions",  href: "/sessions"  },
  { label: "Schedule",  href: "/schedule"  },
  { label: "Reports",   href: "/reports"   },
];

type Props = {
  user: NavUser;
};

export function Header({ user }: Props) {
  const pathname = usePathname();

  return (
    <header className="w-full">

      {/* ── Top Banner — deep purple, org name + env tag ───── */}
      <div className="flex h-[32px] items-center justify-between bg-primary px-4 text-white">
        <span className="text-xs font-semibold tracking-wide">
          {user.orgName}
        </span>
        <span className="rounded-[2px] bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
          Clinic Notes AI
        </span>
      </div>

      {/* ── Nav Bar — logo + nav links + user info ──────────── */}
      <nav className="flex h-16 items-center justify-between border-b border-border-subtle bg-nav-bg px-4">
        {/* Logo mark */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-white text-sm font-bold bg-primary"
          >
            CN
          </div>
          <span className="text-sm font-bold text-primary">
            Clinic Notes AI
          </span>
        </div>

        {/* Nav Links */}
        <ul className="flex h-full items-center gap-1 list-none m-0 p-0">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href} className="h-full flex items-center">
                <Link
                  href={item.href}
                  className={`flex h-full items-center px-4 text-sm font-medium no-underline transition-colors ${
                    isActive
                      ? "bg-secondary text-white"
                      : "bg-transparent text-text-dark hover:bg-[#EEF2FF]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* User info + sign out */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-semibold text-text-dark">
              {user.displayName}
            </p>
            <p className="text-[11px] text-text-muted">
              {user.role}
            </p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="rounded-[2px] border border-border-subtle bg-transparent px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-[#EEF2FF]"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
