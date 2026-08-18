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
}

const SIZE: Record<string, CSSProperties> = {
  xs: { height: "3.8rem", padding: "0 2rem",   fontSize: "1.3rem" },
  sm: { height: "4.8rem", padding: "0 2.8rem", fontSize: "1.5rem" },
  md: { height: "5.8rem", padding: "0 3.2rem", fontSize: "1.7rem" },
  lg: { height: "6.4rem", padding: "0 4rem",   fontSize: "1.9rem" },
};

// Both filled variants pin their own text colour instead of reading a theme
// token. `primary` is white on the dark panel and `onDark` is dark on white,
// and those pairings must hold in either theme — using var(--primary) for the
// type would flip it to near-white in dark mode and print white on white.
const VARIANT: Record<string, CSSProperties> = {
  primary: { background: "var(--btn-fill)", color: "var(--btn-fill-ink)", borderColor: "var(--btn-fill)" },
  outline: { background: "transparent",   color: "var(--primary)", borderColor: "var(--line-strong)" },
  ghost:   { background: "transparent",   color: "var(--secondary)", borderColor: "transparent"   },
  onDark:  { background: "#fff",          color: "#0C5C51",        borderColor: "#fff"            },
};

const HOVER: Record<string, CSSProperties> = {
  primary: { background: "var(--btn-fill-hover)" },
  outline: { background: "var(--wash)", borderColor: "var(--primary)" },
  ghost:   { background: "var(--wash)", color: "var(--primary)" },
  onDark:  { background: "#DDE9E6", borderColor: "#DDE9E6" },
};

export function PrimaryButton({
  children, onClick, disabled, loading,
  variant = "primary", size = "md", type = "button", fullWidth = true,
}: Props) {
  const off = disabled || loading;
  const style: CSSProperties = {
    ...SIZE[size],
    ...VARIANT[variant],
    borderRadius: "9999px",
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.8rem",
    fontWeight: 500,
    letterSpacing: 0,
    lineHeight: 1,
    whiteSpace: "nowrap",
    width: fullWidth ? "100%" : "auto",
    cursor: off ? "not-allowed" : "pointer",
    opacity: disabled ? 0.38 : 1,
    transition: "background 0.18s, border-color 0.18s, color 0.18s, opacity 0.18s, box-shadow 0.18s",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  };

  const hover = HOVER[variant];

  return (
    <motion.button
      type={type}
      onClick={!off ? onClick : undefined}
      whileTap={!off ? { scale: 0.985 } : {}}
      onMouseEnter={(e) => { if (!off) Object.assign(e.currentTarget.style, hover); }}
      onMouseLeave={(e) => { Object.assign(e.currentTarget.style, VARIANT[variant]); }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 3px rgba(43,53,48,0.18)"; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
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
