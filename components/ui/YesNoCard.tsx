"use client";
import { useEffect, useRef } from "react";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}

export function YesNoCard({ value, onChange, placeholder = "Type here" }: Props) {
  const isNo  = value === null;
  const isYes = value !== null;
  const ref   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (isYes) ref.current?.focus(); }, [isYes]);

  const cardStyle = (active: boolean) => ({
    width: "100%",
    textAlign: "left" as const,
    padding: "2rem 2.4rem",
    border: `1px solid ${active ? "var(--primary)" : "var(--line)"}`,
    background: active ? "var(--primary)" : "var(--canvas)",
    borderRadius: "0.6rem",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    WebkitTapHighlightColor: "transparent" as const,
  });

  const radioStyle = (active: boolean) => ({
    flexShrink: 0,
    width: "2rem", height: "2rem",
    borderRadius: "50%",
    border: `2px solid ${active ? "#fff" : "var(--line-strong)"}`,
    display: "flex", alignItems: "center", justifyContent: "center",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      {/* No */}
      <button type="button" onClick={() => onChange(null)} style={cardStyle(isNo)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "1.7rem", fontWeight: 600, color: isNo ? "#fff" : "var(--primary)" }}>No</span>
          <span style={radioStyle(isNo)}>
            {isNo && <span style={{ width: "0.8rem", height: "0.8rem", borderRadius: "50%", background: "#fff" }} />}
          </span>
        </div>
      </button>

      {/* Yes + textarea */}
      <div style={{
        border: `1px solid ${isYes ? "var(--primary)" : "var(--line)"}`,
        borderRadius: "0.6rem",
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}>
        <button type="button" onClick={() => !isYes && onChange("")}
          style={{ ...cardStyle(isYes), border: "none", borderRadius: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: "1.7rem", fontWeight: 600, color: isYes ? "#fff" : "var(--primary)" }}>Yes</span>
              {isYes && <p style={{ fontSize: "1.3rem", marginTop: "0.3rem", color: "rgba(255,255,255,0.5)" }}>Please specify below</p>}
            </div>
            <span style={radioStyle(isYes)}>
              {isYes && <span style={{ width: "0.8rem", height: "0.8rem", borderRadius: "50%", background: "#fff" }} />}
            </span>
          </div>
        </button>
        {isYes && (
          <div style={{ background: "var(--canvas)", padding: "1.6rem 2.4rem", borderTop: "1px solid var(--line)" }}>
            <textarea
              ref={ref}
              rows={2}
              placeholder={placeholder}
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{
                width: "100%",
                fontSize: "1.6rem",
                color: "var(--primary)",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                lineHeight: 1.5,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
