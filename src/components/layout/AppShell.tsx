import { Header } from "@/components/layout/Header";

type AppShellProps = {
  title: string;
  subtitle?: string;
  displayName?: string;
  orgName?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({
  title,
  subtitle,
  displayName,
  orgName,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="ql-page-bg">
      <Header displayName={displayName} orgName={orgName} />
      <main className="ql-shell-main">
        <div className="ql-page">
          <div className="ql-title-row">
            <div>
              <h1 className="ql-title">{title}</h1>
              {subtitle ? <p className="ql-subtitle">{subtitle}</p> : null}
            </div>
            {actions}
          </div>
          <div className="ql-grid">{children}</div>
        </div>
      </main>
    </div>
  );
}
