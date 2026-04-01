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
    <header className="w-full" style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}>

      {/* ── Top Banner — deep purple, org name + env tag ───── */}
      <div
        className="flex items-center justify-between px-4"
        style={{ height: "32px", backgroundColor: "#3B276A", color: "#ffffff" }}
      >
        <span className="text-xs font-semibold tracking-wide">
          {user.orgName}
        </span>
        <span
          className="rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{ backgroundColor: "#746EB1", color: "#ffffff" }}
        >
          Clinic Notes AI
        </span>
      </div>

      {/* ── Nav Bar — logo + nav links + user info ──────────── */}
      <nav
        className="flex items-center justify-between border-b px-4"
        style={{
          height: "64px",
          backgroundColor: "#F9F9F9",
          borderColor: "#E7E9EC",
        }}
      >
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
                  className="flex h-full items-center px-4 text-sm font-medium no-underline transition-colors"
                  style={
                    isActive
                      ? {
                          backgroundColor: "#746EB1",
                          color: "#ffffff",
                          borderBottom: "none",
                        }
                      : {
                          color: "#0B1215",
                          backgroundColor: "transparent",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "#EEF2FF";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
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
              className="rounded-[2px] px-3 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor: "transparent",
                color: "#517AB7",
                border: "1px solid #E7E9EC",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#EEF2FF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
