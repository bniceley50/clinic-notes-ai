import { Header, type NavUser } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SentryUserScope } from "@/components/monitoring/SentryUserScope";

type Props = {
  user: NavUser;
  userId?: string;
  children: React.ReactNode;
};

/**
 * AppShell - wraps authenticated pages with the CareLogic-aligned
 * top-nav header + page content area + footer. Drop this around any page's
 * return value once the user is confirmed authenticated.
 */
export function AppShell({ user, userId, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#F9F9F9" }}>
      <SentryUserScope userId={userId} />
      <Header user={user} />
      <main className="flex-1 px-6 py-6" style={{ backgroundColor: "#F9F9F9" }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
