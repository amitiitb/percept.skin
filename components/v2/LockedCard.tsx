"use client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface Props {
  title: string;
  description: string;
  onUnlock: () => void;
  /** Optional real content to blur behind the CTA — omit for a pure placeholder */
  children?: React.ReactNode;
}

// Design review Decision #14: blur real content + centered unlock CTA, not a greyed
// placeholder. Blurred content gets aria-hidden so screen readers don't announce
// numbers that are visually withheld from free-tier users.
export function LockedCard({ title, description, onUnlock, children }: Props) {
  return (
    <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ filter: "blur(6px)", opacity: 0.6, userSelect: "none", pointerEvents: "none" }}>
        <p style={{ fontSize: "1.3rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>{title}</p>
        {children ?? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
            {[72, 65, 81, 58].map((n, i) => (
              <div key={i} style={{ background: "var(--wash)", borderRadius: "0.8rem", padding: "1.6rem" }}>
                <strong style={{ fontSize: "2.4rem", color: "var(--primary)" }}>{n}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.2rem", padding: "2rem", background: "linear-gradient(180deg, var(--scrim-top), var(--scrim-bottom))" }}>
        <p style={{ fontSize: "1.6rem", fontWeight: 500, color: "var(--primary)", textAlign: "center", margin: 0 }}>{title}</p>
        <p style={{ fontSize: "1.4rem", color: "var(--secondary)", textAlign: "center", margin: 0, maxWidth: "32rem" }}>{description}</p>
        <PrimaryButton fullWidth={false} onClick={onUnlock}>Unlock full report →</PrimaryButton>
      </div>
    </div>
  );
}
