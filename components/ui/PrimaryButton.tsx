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

// Resting shadow per variant — filled buttons get a soft ambient lift plus a
// 1px top highlight (inset) so the pill reads as a raised object rather than a
// flat sticker. Transparent variants stay shadowless at rest.
const REST_SHADOW: Record<string, string> = {
  primary: "0 1px 2px rgba(0,0,0,0.12), 0 8px 24px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.14)",
  onDark:  "0 1px 2px rgba(0,0,0,0.10), 0 10px 28px -10px rgba(12,92,81,0.45), inset 0 1px 0 rgba(255,255,255,0.6)",
  outline: "none",
  ghost:   "none",
};

// Hover shadow — deeper, wider ambient spread to pair with the -2px lift.
const HOVER_SHADOW: Record<string, string> = {
  primary: "0 2px 4px rgba(0,0,0,0.14), 0 16px 40px -10px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.16)",
  onDark:  "0 2px 4px rgba(0,0,0,0.12), 0 18px 44px -12px rgba(12,92,81,0.5), inset 0 1px 0 rgba(255,255,255,0.7)",
  outline: "none",
  ghost:   "none",
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
  onDark:  { background: "#EAF2EF", borderColor: "#EAF2EF" },
};

export function PrimaryButton({
  children, onClick, disabled, loading,
  variant = "primary", size = "md", type = "button", fullWidth = true,
}: Props) {
  const off = disabled || loading;
  const restShadow = REST_SHADOW[variant] ?? "none";
  const hoverShadow = HOVER_SHADOW[variant] ?? "none";

  const style: CSSProperties = {
    ...SIZE[size],
    ...VARIANT[variant],
    borderRadius: "9999px",
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
    boxShadow: off ? "none" : restShadow,
    transform: "translateY(0)",
    transition: "background 0.18s, border-color 0.18s, color 0.18s, opacity 0.18s, box-shadow 0.2s ease, transform 0.2s ease",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  };

  const enter = (el: HTMLButtonElement) => {
    Object.assign(el.style, HOVER[variant]);
    el.style.boxShadow = hoverShadow;
    el.style.transform = "translateY(-2px)";
  };
  const leave = (el: HTMLButtonElement) => {
    Object.assign(el.style, VARIANT[variant]);
    el.style.boxShadow = restShadow;
    el.style.transform = "translateY(0)";
  };

  return (
    <motion.button
      type={type}
      onClick={!off ? onClick : undefined}
      whileTap={!off ? { scale: 0.97 } : {}}
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
