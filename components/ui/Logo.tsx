interface LogoProps {
  height?: string;
  className?: string;
  /** "light" renders the same wordmark in solid white via filter, for
   *  placement on dark or photo backgrounds where the brand teal (hardcoded
   *  in the SVG, not theme-aware) would be low-contrast. Same technique the
   *  homepage header already uses for its transparent-over-photo state. */
  variant?: "auto" | "light";
}

export function Logo({ height = "2.2rem", className, variant = "auto" }: LogoProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height, lineHeight: 0 }} className={className}>
      <img
        src="/brand/percept-ai-logo.svg"
        alt="Percept AI"
        style={{
          display: "block", width: "auto", height,
          filter: variant === "light" ? "brightness(0) invert(1)" : undefined,
        }}
      />
    </span>
  );
}
