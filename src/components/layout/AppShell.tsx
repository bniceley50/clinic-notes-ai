import { Header, type NavUser } from "@/components/layout/Header";

type Props = {
  user: NavUser;
  children: React.ReactNode;
};

/**
 * AppShell — wraps authenticated pages with the CareLogic-aligned
 * top-nav header + page content area. Drop this around any page's
 * return value once the user is confirmed authenticated.
 */
export function AppShell({ user, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#F9F9F9" }}>
      <Header user={user} />
      <main className="flex-1 px-6 py-6" style={{ backgroundColor: "#F9F9F9" }}>
        {children}
      </main>
    </div>
  );
}
