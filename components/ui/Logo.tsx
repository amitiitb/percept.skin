// Below 460px the full wordmark competes with header buttons (Start free,
// theme toggle, menu) for room and starts overlapping them. A "PS" monogram
// swaps in there instead of letting the wordmark run into neighboring
// buttons or shrinking it to the point of being unreadable.
export function Logo({ height = "2.2rem", className }: { height?: string; className?: string }) {
  return (
    <span style={{ display: "inline-block", height, lineHeight: 0 }} className={className}>
      <img src="/brand/percept-logo.png" alt="Percept" style={{ width: "auto", height }} className="logo-light-mark logo-full-mark" />
      <img src="/brand/percept-logo-dark.png" alt="Percept" style={{ width: "auto", height }} className="logo-dark-mark logo-full-mark" />
      <span
        className="logo-compact-mark"
        role="img"
        aria-label="Percept"
        style={{
          display: "none", alignItems: "center", justifyContent: "center",
          height, width: height, borderRadius: "50%", background: "var(--wash)",
          fontWeight: 800, fontSize: `calc(${height} * 0.42)`, letterSpacing: "-0.02em", color: "var(--primary)",
        }}
      >
        <span aria-hidden="true">P<span style={{ color: "var(--rose)" }}>S</span></span>
      </span>
      <style>{`
        @media (max-width: 460px) {
          .logo-full-mark { display: none !important; }
          .logo-compact-mark { display: inline-flex !important; }
        }
      `}</style>
    </span>
  );
}
