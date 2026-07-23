"use client";
import { motion } from "framer-motion";
import { ReactNode, CSSProperties } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
  fullWidth?: boolean;
}

const SIZE: Record<string, CSSProperties> = {
  sm: { height: "4.8rem", padding: "0 2.8rem", fontSize: "1.5rem" },
  md: { height: "5.8rem", padding: "0 3.2rem", fontSize: "1.7rem" },
  lg: { height: "6.4rem", padding: "0 4rem",   fontSize: "1.9rem" },
};

const VARIANT: Record<string, CSSProperties> = {
  primary: { background: "var(--primary)", color: "#fff",          borderColor: "var(--primary)"  },
  outline: { background: "transparent",   color: "var(--primary)", borderColor: "var(--line-strong)" },
  ghost:   { background: "transparent",   color: "var(--secondary)", borderColor: "transparent"   },
};

const HOVER: Record<string, CSSProperties> = {
  primary: { background: "#3A463F" },
  outline: { background: "var(--wash)", borderColor: "var(--primary)" },
  ghost:   { background: "var(--wash)", color: "var(--primary)" },
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
