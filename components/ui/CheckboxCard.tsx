"use client";
import { CSSProperties } from "react";

interface Props {
  label: string;
  sub?: string;
  checked: boolean;
  onToggle: () => void;
}

export function CheckboxCard({ label, sub, checked, onToggle }: Props) {
  const btn: CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "1.8rem 2.4rem",
    border: `1px solid ${checked ? "var(--primary)" : "var(--line)"}`,
    background: checked ? "var(--btn-fill)" : "var(--canvas)",
    borderRadius: "0.6rem",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    WebkitTapHighlightColor: "transparent",
  };

  return (
    <button type="button" onClick={onToggle} style={btn}
      onMouseEnter={e => { if (!checked) e.currentTarget.style.borderColor = "var(--body)"; }}
      onMouseLeave={e => { if (!checked) e.currentTarget.style.borderColor = "var(--line)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
        <span style={{
          flexShrink: 0,
          width: "2rem", height: "2rem",
          borderRadius: "0.4rem",
          border: `2px solid ${checked ? "#fff" : "var(--line-strong)"}`,
          background: checked ? "#fff" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}>
          {checked && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <div>
          <p style={{ fontSize: "1.6rem", fontWeight: 600, color: checked ? "#fff" : "var(--primary)", lineHeight: 1.2 }}>{label}</p>
          {sub && <p style={{ fontSize: "1.3rem", marginTop: "0.3rem", color: checked ? "rgba(255,255,255,0.6)" : "var(--secondary)" }}>{sub}</p>}
        </div>
      </div>
    </button>
  );
}
