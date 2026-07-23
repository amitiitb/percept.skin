"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { PLANS, type PlanId } from "@/lib/v2/paypal";

const FREE_FEATURES = [
  "One introductory scan", "Basic Glow Score", "Limited skin overview",
  "Limited hair overview", "Three basic recommendations",
];
const PREMIUM_FEATURES = [
  "Full skin, face, and hair report", "Skin age analysis", "Detailed recommendations",
  "Downloadable report", "Saved report history", "Progress tracking & scan comparison",
];

export default function V2PlansPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanId>("annual");

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
      <div style={{ maxWidth: "96rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "3.6rem", fontWeight: 400, color: "var(--primary)", textAlign: "center", marginBottom: "1.2rem" }}>
          Choose your plan
        </h1>
        <p style={{ fontSize: "1.6rem", color: "var(--secondary)", textAlign: "center", marginBottom: "4.8rem" }}>
          Free plan works forever. Upgrade any time.
        </p>

        <div className="v2-plan-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "4.8rem" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem" }}>
            <h2 style={{ fontSize: "2rem", color: "var(--primary)", marginBottom: "0.4rem" }}>Free</h2>
            <p style={{ fontSize: "1.4rem", color: "var(--secondary)", marginBottom: "2rem" }}>$0 forever</p>
            {FREE_FEATURES.map((f) => (
              <p key={f} style={{ fontSize: "1.4rem", color: "var(--secondary)", marginBottom: "1rem" }}>· {f}</p>
            ))}
          </div>

          <div style={{ background: "var(--primary)", borderRadius: "1.6rem", padding: "3.2rem", color: "#fff" }}>
            <h2 style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>Glowmetry Premium</h2>
            <p style={{ fontSize: "1.4rem", color: "rgba(255,255,255,0.7)", marginBottom: "2rem" }}>Everything, unlocked</p>
            {PREMIUM_FEATURES.map((f) => (
              <p key={f} style={{ fontSize: "1.4rem", color: "rgba(255,255,255,0.9)", marginBottom: "1rem" }}>· {f}</p>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center", marginBottom: "3.2rem", flexWrap: "wrap" }}>
          {(Object.keys(PLANS) as PlanId[]).map((id) => (
            <button key={id} onClick={() => setSelected(id)} style={{
              padding: "1.6rem 2.4rem", borderRadius: "1.2rem", cursor: "pointer", position: "relative",
              border: `2px solid ${selected === id ? "var(--primary)" : "var(--line)"}`,
              background: selected === id ? "var(--primary)" : "var(--canvas)",
              color: selected === id ? "#fff" : "var(--primary)", textAlign: "center", minWidth: "16rem",
            }}>
              {id === "annual" && (
                <span style={{ position: "absolute", top: "-1.2rem", left: "50%", transform: "translateX(-50%)", background: "var(--rose)", color: "#fff", fontSize: "1.1rem", fontWeight: 700, padding: "0.3rem 1rem", borderRadius: "9999px" }}>
                  Best value
                </span>
              )}
              <p style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>{PLANS[id].label}</p>
              <p style={{ fontSize: "1.3rem", margin: "0.4rem 0 0", opacity: 0.8 }}>${PLANS[id].price}</p>
            </button>
          ))}
        </div>

        <div style={{ maxWidth: "36rem", margin: "0 auto" }}>
          <PrimaryButton onClick={() => router.push(`/v2/checkout?plan=${selected}`)}>
            Continue with {PLANS[selected].label} →
          </PrimaryButton>
        </div>
      </div>
      <style>{`@media (max-width: 700px) { .v2-plan-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
