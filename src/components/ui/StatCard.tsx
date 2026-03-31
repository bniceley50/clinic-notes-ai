// src/components/ui/StatCard.tsx
// Reusable CareLogic-style summary stat card for dashboard and reports

type Props = {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "primary" | "accent" | "success" | "muted";
};

const VARIANT_COLORS = {
  primary: { header: "#3B276A", text: "#3B276A" },
  accent:  { header: "#517AB7", text: "#517AB7" },
  success: { header: "#2E7D32", text: "#2E7D32" },
  muted:   { header: "#777777", text: "#777777" },
};

export function StatCard({ label, value, subtext, variant = "accent" }: Props) {
  const colors = VARIANT_COLORS[variant];

  return (
    <div
      className="card-ql flex flex-col overflow-hidden"
      style={{ minWidth: 0 }}
    >
      {/* Color band at top */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: colors.header }}
      />
      <div className="px-4 py-3">
        <p
          className="text-[11px] font-bold uppercase tracking-wider text-text-muted"
        >
          {label}
        </p>
        <p
          className="mt-1 text-2xl font-bold"
          style={{ color: colors.text, lineHeight: 1.1 }}
        >
          {value}
        </p>
        {subtext && (
          <p className="mt-1 text-[11px] text-text-muted">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
