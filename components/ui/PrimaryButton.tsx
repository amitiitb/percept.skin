"use client";
import { motion } from "framer-motion";
import { ReactNode, CSSProperties } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** `onDark` is the filled variant for use on the primary-coloured cards,
   *  where `primary` renders dark-on-dark and reads as an outline button. */
  variant?: "primary" | "outline" | "ghost" | "onDark";
  size?: "xs" | "sm" | "md" | "lg";
  type?: "button" | "submit";
  fullWidth?: boolean;
  emphasis?: boolean;
}

const SIZE: Record<string, CSSProperties> = {
  xs: { height: "3.8rem", padding: "0 2rem",   fontSize: "1.3rem" },
  sm: { height: "4.8rem", padding: "0 2.8rem", fontSize: "1.5rem" },
  md: { height: "5.8rem", padding: "0 3.2rem", fontSize: "1.7rem" },
  lg: { height: "6.4rem", padding: "0 4rem",   fontSize: "1.9rem" },
};

// Flat by design: no resting or hover shadow, no lift. The button reads as a
// solid block of colour that only shifts shade on hover/press. Kept as maps so
// the render code below stays unchanged.
const REST_SHADOW: Record<string, string> = {
  primary: "none", onDark: "none", outline: "none", ghost: "none",
};

const HOVER_SHADOW: Record<string, string> = {
  primary: "none", onDark: "none", outline: "none", ghost: "none",
};

// Both filled variants pin their own text colour instead of reading a theme
// token. `primary` is white on the dark panel and `onDark` is dark on white,
// and those pairings must hold in either theme — using var(--primary) for the
// type would flip it to near-white in dark mode and print white on white.
const VARIANT: Record<string, CSSProperties> = {
  primary: { background: "#0C5C51", color: "#FFFFFF", borderColor: "#1A9E8F" },
  outline: { background: "transparent",   color: "var(--primary)", borderColor: "var(--line-strong)" },
  ghost:   { background: "transparent",   color: "var(--secondary)", borderColor: "transparent"   },
  onDark:  { background: "#fff",          color: "#0C5C51",        borderColor: "#fff"            },
};

const HOVER: Record<string, CSSProperties> = {
  primary: { background: "#12786C", borderColor: "#1A9E8F" },
  outline: { background: "var(--wash)", borderColor: "var(--primary)" },
  ghost:   { background: "var(--wash)", color: "var(--primary)" },
  onDark:  { background: "#EAF2EF", borderColor: "#EAF2EF" },
};

export function PrimaryButton({
  children, onClick, disabled, loading,
  variant = "primary", size = "md", type = "button", fullWidth = true, emphasis = false,
}: Props) {
  const off = disabled || loading;
  const restShadow = REST_SHADOW[variant] ?? "none";
  const hoverShadow = HOVER_SHADOW[variant] ?? "none";

  const style: CSSProperties = {
    ...SIZE[size],
    ...VARIANT[variant],
    borderRadius: 0,
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.8rem",
    fontWeight: 600,
    letterSpacing: "0.005em",
    lineHeight: 1,
    whiteSpace: "nowrap",
    width: fullWidth ? "100%" : "auto",
    cursor: off ? "not-allowed" : "pointer",
    opacity: disabled ? 0.38 : 1,
    boxShadow: off ? "none" : emphasis ? "0 1.2rem 2.8rem -1.2rem rgba(12,92,81,0.5), 0 0.3rem 0.8rem rgba(10,40,35,0.18)" : restShadow,
    transition: "background 0.18s, border-color 0.18s, color 0.18s, opacity 0.18s, box-shadow 0.18s",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  };

  const enter = (el: HTMLButtonElement) => {
    Object.assign(el.style, HOVER[variant]);
    el.style.boxShadow = emphasis ? "0 1.6rem 3.2rem -1.2rem rgba(12,92,81,0.58), 0 0.4rem 1rem rgba(10,40,35,0.2)" : hoverShadow;
  };
  const leave = (el: HTMLButtonElement) => {
    Object.assign(el.style, VARIANT[variant]);
    el.style.boxShadow = emphasis ? "0 1.2rem 2.8rem -1.2rem rgba(12,92,81,0.5), 0 0.3rem 0.8rem rgba(10,40,35,0.18)" : restShadow;
  };

  return (
    <motion.button
      type={type}
      onClick={!off ? onClick : undefined}
      whileHover={!off && emphasis ? { y: -3 } : {}}
      whileTap={!off ? { scale: 0.97, y: 0 } : {}}
      onMouseEnter={(e) => { if (!off) enter(e.currentTarget); }}
      onMouseLeave={(e) => { if (!off) leave(e.currentTarget); }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = `${restShadow === "none" ? "" : restShadow + ", "}0 0 0 3px rgba(26,158,143,0.35)`; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = off ? "none" : restShadow; }}
      style={style}
    >
      {loading ? (
        <motion.svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}>
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </motion.svg>
      ) : children}
    </motion.button>
  );
}
