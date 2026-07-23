"use client";
import { ReactNode, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface Props {
  children: ReactNode;
  headline: string;
  sub: string;
  progress?: number; // 0-100, omit to hide progress bar
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
}

// Lightweight v2 counterpart to components/layout/FunnelLayout.tsx — same visual
// language (left panel, mobile header, progress bar) but without the old funnel's
// hardcoded 4-stage journey list, since v2's stages don't map to it. The original
// FunnelLayout is left untouched (Decision #1 — zero shared code with the live funnel).
export function V2Layout({ children, headline, sub, progress, showBack = true, backHref, onBack }: Props) {
  const router = useRouter();
  const handleBack = () => {
    if (onBack) onBack();
    else if (backHref) router.push(backHref);
    else router.back();
  };

  const panelL: CSSProperties = {
    display: "none",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "var(--primary)",
    padding: "5.6rem 6.4rem",
    position: "sticky",
    top: 0,
    height: "100dvh",
    overflow: "hidden",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex" }}>
      <div className="v2-left" style={panelL}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.035,
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <a href="/v2/splash" style={{
          position: "relative", zIndex: 1,
          fontSize: "2.2rem", fontWeight: 600, color: "#fff", letterSpacing: "-0.02em",
          textDecoration: "none",
        }}>
          Glow<span style={{ color: "var(--rose)" }}>metry</span>
        </a>
        <motion.div key={headline} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }} style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "4.4rem", fontWeight: 500, color: "#fff", lineHeight: 1.08, letterSpacing: "-0.025em", marginBottom: "1.6rem" }}>
            {headline}
          </h2>
          <p style={{ fontSize: "1.7rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.55, maxWidth: "34rem" }}>{sub}</p>
          {progress !== undefined && (
            <div style={{ marginTop: "4.8rem", height: "2px", width: "100%", background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <motion.div style={{ height: "100%", background: "rgba(255,255,255,0.7)" }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
            </div>
          )}
        </motion.div>
        <div style={{ position: "relative", zIndex: 1, fontSize: "1.2rem", color: "rgba(255,255,255,0.3)" }}>
          Cosmetic & wellness insights — not a medical diagnosis
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        <div className="v2-mobile-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.6rem 2rem", borderBottom: "1px solid var(--line)" }}>
          {showBack ? (
            <button onClick={handleBack} aria-label="Go back" style={{ width: "4.4rem", height: "4.4rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "1px solid var(--line)", color: "var(--secondary)", background: "transparent", cursor: "pointer" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : <div style={{ width: "4.4rem" }} />}
          <span style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary)", letterSpacing: "-0.02em" }}>
            Glow<span style={{ color: "var(--rose)" }}>metry</span>
          </span>
          <div style={{ width: "4.4rem" }} />
        </div>

        {progress !== undefined && (
          <div className="v2-mobile-progress" style={{ height: "4px", background: "var(--line)" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "var(--primary)", transition: "width 0.4s" }} />
          </div>
        )}

        <motion.div key={headline} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "2.8rem 2rem 4rem", width: "100%" }} className="v2-content">
          {children}
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .v2-left            { display: flex !important; width: 42%; max-width: 56rem; }
          .v2-mobile-header   { display: none !important; }
          .v2-mobile-progress { display: none !important; }
          .v2-content         { padding: 4.8rem 6.4rem 6.4rem !important; max-width: 112rem; margin: 0 auto; }
        }
      `}</style>
    </div>
  );
}
