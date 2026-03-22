import { redirect } from "next/navigation";
import { loadCurrentUser } from "@/lib/auth/loader";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminHealthSnapshot } from "@/lib/admin/health";
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default async function AdminPage() {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  if (result.user.role !== "admin") {
    redirect("/dashboard");
  }

  const db = createServiceClient();
  const [membersResult, invitesResult, healthResult] = await Promise.all([
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
    getAdminHealthSnapshot(result.user.orgId),
  ]);

  const members = (membersResult.data ?? []) as MemberRow[];
  const invites = (invitesResult.data ?? []) as InviteRow[];
  const health = healthResult.data;

  return (
    <main>
      <h1>Admin</h1>

      <section>
        <h2>Operator Health</h2>
        {healthResult.error || !health ? (
          <p>
            Failed to load operator health data.
            {healthResult.error ? ` ${healthResult.error}` : ""}
          </p>
        ) : (
          <>
            <p>
              Generated {formatDateTime(health.generatedAt)}. Stuck job heuristic:
              {" "}
              {health.stuckThresholdMinutes}
              {" "}
              minutes. Failed jobs window:
              {" "}
              {health.failedWindowHours}
              {" "}
              hours.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Stuck running jobs</td>
                  <td>{health.summary.stuckRunningCount}</td>
                </tr>
                <tr>
                  <td>Stuck queued jobs</td>
                  <td>{health.summary.stuckQueuedCount}</td>
                </tr>
                <tr>
                  <td>Failed jobs in last 24 hours</td>
                  <td>{health.summary.failedLast24HoursCount}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </section>

      <section>
        <h2>Stuck Jobs</h2>
        {healthResult.error || !health ? null : health.stuckJobs.length === 0 ? (
          <p>No stuck jobs by the current 15 minute operator heuristic.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Session</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Attempts</th>
                <th>Created</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {health.stuckJobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>{job.sessionId}</td>
                  <td>{job.createdByName}</td>
                  <td>{job.heuristic === "stuck_running" ? "Running" : "Queued"}</td>
                  <td>{job.stage}</td>
                  <td>{job.attemptCount}</td>
                  <td>{formatDateTime(job.createdAt)}</td>
                  <td>{formatDateTime(job.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Failed Jobs (Last 24 Hours)</h2>
        {healthResult.error || !health ? null : health.failedJobs.length === 0 ? (
          <p>No failed jobs in the last 24 hours.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Session</th>
                <th>Owner</th>
                <th>Attempts</th>
                <th>Error</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {health.failedJobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>{job.sessionId}</td>
                  <td>{job.createdByName}</td>
                  <td>{job.attemptCount}</td>
                  <td>{job.errorMessage ?? "Unknown failure"}</td>
                  <td>{formatDateTime(job.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Recent Audit Events</h2>
        {healthResult.error || !health ? null : health.recentAuditEvents.length === 0 ? (
          <p>No recent audit events found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Session</th>
                <th>Job</th>
                <th>Success</th>
              </tr>
            </thead>
            <tbody>
              {health.recentAuditEvents.map((event) => (
                <tr key={`${event.createdAt}:${event.actorId}:${event.action}`}>
                  <td>{formatDateTime(event.createdAt)}</td>
                  <td>{event.actorName}</td>
                  <td>{event.action}</td>
                  <td>
                    {event.entityType}
                    {event.entityId ? ` (${event.entityId})` : ""}
                  </td>
                  <td>{event.sessionId ?? "-"}</td>
                  <td>{event.jobId ?? "-"}</td>
                  <td>
                    {event.success === null ? "-" : event.success ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
                <td>{formatDateTime(member.created_at)}</td>
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
                <td>{formatDateTime(invite.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
