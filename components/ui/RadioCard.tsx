"use client";
import { CSSProperties } from "react";

interface Props {
  label: string;
  sub?: string;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
}

export function RadioCard({ label, sub, selected, onSelect, badge }: Props) {
  const btn: CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "2rem 2.4rem",
    border: `1px solid ${selected ? "var(--primary)" : "var(--line)"}`,
    background: selected ? "var(--primary)" : "var(--canvas)",
    borderRadius: "0.6rem",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    WebkitTapHighlightColor: "transparent",
  };

  return (
    <button type="button" onClick={onSelect} style={btn}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = "var(--body)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = "var(--line)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.6rem" }}>
        <div>
          <p style={{ fontSize: "1.7rem", fontWeight: 600, color: selected ? "#fff" : "var(--primary)", lineHeight: 1.2 }}>{label}</p>
          {sub && <p style={{ fontSize: "1.4rem", marginTop: "0.4rem", color: selected ? "rgba(255,255,255,0.6)" : "var(--secondary)", lineHeight: 1.4 }}>{sub}</p>}
          {badge && (
            <span style={{
              display: "inline-block", marginTop: "0.8rem",
              fontSize: "1.1rem", fontWeight: 600, padding: "0.4rem 1rem",
              background: "rgba(200,80,58,0.1)", color: "var(--rose)",
              borderRadius: "9999px",
            }}>{badge}</span>
          )}
        </div>
        <span style={{
          flexShrink: 0,
          width: "2rem", height: "2rem",
          borderRadius: "50%",
          border: `2px solid ${selected ? "#fff" : "var(--line-strong)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 0.15s",
        }}>
          {selected && <span style={{ width: "0.8rem", height: "0.8rem", borderRadius: "50%", background: "#fff" }} />}
        </span>
      </div>
    </button>
  );
}
