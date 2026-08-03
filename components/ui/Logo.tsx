export function Logo({ height = "2.2rem", className }: { height?: string; className?: string }) {
  return (
    <span style={{ display: "inline-block", height, lineHeight: 0 }} className={className}>
      <img src="/brand/percept-logo.png" alt="Percept" style={{ width: "auto", height }} className="logo-light-mark" />
      <img src="/brand/percept-logo-dark.png" alt="Percept" style={{ width: "auto", height }} className="logo-dark-mark" />
    </span>
  );
}
