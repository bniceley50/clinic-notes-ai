type StatCardProps = {
  label: string;
  value: string | number;
  note?: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <section className="ql-stat" aria-label={label}>
      <div className="ql-stat-label">{label}</div>
      <div className="ql-stat-value">{value}</div>
      {note ? <div className="ql-stat-note">{note}</div> : null}
    </section>
  );
}
