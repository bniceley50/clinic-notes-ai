// src/components/ui/StatCard.tsx
// Reusable CareLogic-style summary stat card for dashboard and reports

type Props = {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "primary" | "accent" | "success" | "muted";
};

const VARIANT_COLORS = {
  primary: { header: "bg-primary", text: "text-primary" },
  accent:  { header: "bg-accent", text: "text-accent" },
  success: { header: "bg-[#2E7D32]", text: "text-[#2E7D32]" },
  muted:   { header: "bg-text-muted", text: "text-text-muted" },
};

export function StatCard({ label, value, subtext, variant = "accent" }: Props) {
  const colors = VARIANT_COLORS[variant];

  return (
    <div className="card-ql flex min-w-0 flex-col overflow-hidden">
      {/* Color band at top */}
      <div className={`h-1 w-full ${colors.header}`} />
      <div className="px-4 py-3">
        <p
          className="text-[11px] font-bold uppercase tracking-wider text-text-muted"
        >
          {label}
        </p>
        <p className={`mt-1 text-2xl font-bold leading-[1.1] ${colors.text}`}>
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
