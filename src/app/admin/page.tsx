import { redirect } from "next/navigation";
import { loadCurrentUser } from "@/lib/auth/loader";
import { createServiceClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/admin/InviteForm";

type MemberRow = {
  id: string;
  display_name: string;
  role: string;
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

export default async function AdminPage() {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  if (result.user.role !== "admin") {
    redirect("/dashboard");
  }

  const db = createServiceClient();
  const [membersResult, invitesResult] = await Promise.all([
    db
      .from("profiles")
      .select("id, display_name, role, created_at")
      .eq("org_id", result.user.orgId)
      .order("created_at", { ascending: true }),
    db
      .from("invites")
      .select("id, email, role, created_at")
      .eq("org_id", result.user.orgId)
      .is("used_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const members = (membersResult.data ?? []) as MemberRow[];
  const invites = (invitesResult.data ?? []) as InviteRow[];

  return (
    <main>
      <h1>Admin</h1>

      <section>
        <h2>Invite Clinician</h2>
        <InviteForm />
      </section>

      <section>
        <h2>Current Org Members</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.display_name}</td>
                <td>{member.role}</td>
                <td>{new Date(member.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Pending Invites</h2>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <tr key={invite.id}>
                <td>{invite.email}</td>
                <td>{invite.role}</td>
                <td>{new Date(invite.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
