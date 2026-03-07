type CompactFilterBarProps = {
  children: React.ReactNode;
};

export function CompactFilterBar({ children }: CompactFilterBarProps) {
  return <div className="ql-filter-row">{children}</div>;
}
