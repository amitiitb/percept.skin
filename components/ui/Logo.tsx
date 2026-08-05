export function Logo({ height = "2.2rem", className }: { height?: string; className?: string }) {
  return (
    <span style={{ display: "inline-block", height, lineHeight: 0 }} className={className}>
      <img src="/brand/percept-ai-logo.svg" alt="Percept AI" style={{ width: "auto", height }} />
    </span>
  );
}
