import { redirect } from "next/navigation";
import { loadCurrentUser } from "@/lib/auth/loader";
import { AppShell } from "@/components/layout/AppShell";
import { CompactFilterBar } from "@/components/ui/CompactFilterBar";

const AGENDA = [
  {
    time: "08:30",
    label: "Patient A",
    provider: "Primary Provider",
    status: "Checked In",
    today: true,
  },
  {
    time: "09:00",
    label: "Patient B",
    provider: "Primary Provider",
    status: "Scheduled",
    today: true,
  },
  {
    time: "10:15",
    label: "Patient C",
    provider: "Primary Provider",
    status: "Draft Pending",
    today: true,
  },
  {
    time: "13:00",
    label: "Patient D",
    provider: "Primary Provider",
    status: "Follow-Up",
    today: false,
  },
  {
    time: "14:30",
    label: "Patient E",
    provider: "Primary Provider",
    status: "Scheduled",
    today: false,
  },
];

export default async function SchedulePage() {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  const { user } = result;

  return (
    <AppShell
      title="Schedule"
      subtitle={`${user.profile.display_name} | ${user.org.name}`}
      displayName={user.profile.display_name}
      orgName={user.org.name}
    >
      <div className="ql-alert ql-alert-warning">
        DEMO/STUB. Agenda data is sanitized placeholder content for Milestone 0
        visual parity work.
      </div>

      <CompactFilterBar>
        <div className="ql-field" style={{ width: 150 }}>
          <label className="ql-label" htmlFor="schedule-date">
            Date
          </label>
          <input
            id="schedule-date"
            className="ql-input"
            value={new Date().toLocaleDateString()}
            readOnly
          />
        </div>
        <div className="ql-field" style={{ width: 160 }}>
          <label className="ql-label" htmlFor="schedule-view">
            View
          </label>
          <select id="schedule-view" className="ql-select" defaultValue="day" disabled>
            <option value="day">Day Agenda</option>
          </select>
        </div>
        <button type="button" className="ql-button-secondary">
          Today
        </button>
      </CompactFilterBar>

      <section className="ql-panel">
        <p className="ql-kicker">Day Agenda</p>
        <h2 className="ql-panel-title">Provider Schedule</h2>
        <div className="ql-agenda" style={{ marginTop: 10 }}>
          {AGENDA.map((entry) => (
            <div
              key={`${entry.time}-${entry.label}`}
              className={`ql-agenda-row ${entry.today ? "is-today" : ""}`}
            >
              <div className="ql-agenda-cell">
                <strong>{entry.time}</strong>
              </div>
              <div className="ql-agenda-cell">
                <div>{entry.label}</div>
                <div className="ql-subtitle">{entry.provider}</div>
              </div>
              <div className="ql-agenda-cell">
                <span className="ql-chip">{entry.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
