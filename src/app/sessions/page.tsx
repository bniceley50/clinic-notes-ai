import { redirect } from "next/navigation";
import { loadCurrentUser } from "@/lib/auth/loader";
import { listMySessions } from "@/lib/sessions/queries";
import { CreateSessionForm } from "@/components/sessions/CreateSessionForm";
import { SessionList } from "@/components/sessions/SessionList";
import { AppShell } from "@/components/layout/AppShell";

export default async function SessionsPage() {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  const { user } = result;
  const { data: sessions, error } = await listMySessions(user);

  return (
    <AppShell
      user={{
        displayName: user.profile.display_name,
        orgName: user.org.name,
        role: user.role,
      }}
      userId={user.userId}
    >
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold uppercase tracking-wider" style={{ color: "#517AB7" }}>
            Sessions
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: "#777777" }}>
            {user.org.name} - {user.profile.display_name}
          </p>
        </div>
      </div>

      {/* Create session form */}
      <CreateSessionForm />

      {/* Error state */}
      {error && (
        <p className="mt-4 text-sm font-medium" style={{ color: "#CC2200" }}>
          Failed to load sessions: {error}
        </p>
      )}

      <SessionList
        sessions={sessions}
        error={error}
        currentUserId={user.userId}
        currentUserRole={user.role}
      />
    </AppShell>
  );
}
