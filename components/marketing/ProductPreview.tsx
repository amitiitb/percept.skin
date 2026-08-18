"use client";
import { useState } from "react";
import Image from "next/image";
import { IconFaceScan, IconPalette, IconScissors, IconGlasses } from "@/components/ui/icons";

/**
 * The homepage's "product as hero artwork" component — a static, art-directed
 * mockup of the real report UI (same tab names, same metric vocabulary as
 * lib/v2/types.ts / lib/v2/faceMetricGroups.ts / the real TabBar in
 * app/report/[id]/page.tsx), built as its own lightweight component rather
 * than embedding the live report. That keeps it screenshot-stable, free of
 * any real user's photo/PII, and fully art-directable, while still reading
 * as an authentic capture of the product rather than generic dashboard art.
 *
 * Reused across the hero, the reveal section, the command centre, and the
 * recommendations section via `variant`, which only changes which tab is
 * active by default and how tall the card renders — the chrome is shared.
 */

type TabId = "skin" | "colour" | "hairstyle" | "frame";

const TABS: { id: TabId; label: string; icon: typeof IconFaceScan; accent: string }[] = [
  { id: "skin", label: "Skin Analysis", icon: IconFaceScan, accent: "#1A9E8F" },
  { id: "colour", label: "Colour Analysis", icon: IconPalette, accent: "#C8503A" },
  { id: "hairstyle", label: "Hairstyle Suggestions", icon: IconScissors, accent: "#C08420" },
  { id: "frame", label: "Frame Try-On", icon: IconGlasses, accent: "#2E7D5B" },
];

const SKIN_METRICS = [
  { name: "Texture", score: 82 },
  { name: "Tone evenness", score: 76 },
  { name: "Pores", score: 68 },
  { name: "Hydration", score: 88 },
];

const HARMONY_METRICS = [
  { name: "Facial symmetry", score: 91 },
  { name: "Cheek balance", score: 84 },
  { name: "Overall facial harmony", score: 87 },
];

const COLOUR_SWATCHES = ["#0F3A35", "#C8503A", "#D9A62E", "#7C6CC4", "#2E7D5B", "#8C9B97"];

function ScoreRing({ value, size = 92 }: { value: number; size?: number }) {
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#111111" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="53%" textAnchor="middle" fontSize={size * 0.26} fontWeight={600} fill="#111111">
        {value}
      </text>
    </svg>
  );
}

function MetricBar({ name, score, accent }: { name: string; score: number; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.25rem", color: "var(--ink)" }}>
        <span>{name}</span>
        <span style={{ color: "var(--ink-secondary)" }}>{score}</span>
      </div>
      <div style={{ height: "0.5rem", borderRadius: "999px", background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", borderRadius: "999px", background: accent }} />
      </div>
    </div>
  );
}

export function ProductPreview({
  defaultTab = "skin",
  image = "/marketing/portraits/deep-brown.png",
  className,
}: {
  defaultTab?: TabId;
  image?: string;
  className?: string;
}) {
  const [tab, setTab] = useState<TabId>(defaultTab);
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className={className} style={{ position: "relative", width: "100%" }}>
      <div className="pg-card" style={{ overflow: "hidden" }}>
        {/* Chrome bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", padding: "1.4rem 2rem", borderBottom: "1px solid var(--border-neutral)" }}>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            {["#E4635A", "#E6B84A", "#54B577"].map((c) => (
              <span key={c} style={{ width: "1rem", height: "1rem", borderRadius: "50%", background: c }} />
            ))}
          </div>
          <span style={{ flex: 1, textAlign: "center", fontSize: "1.2rem", color: "var(--ink-secondary)", fontWeight: 500 }}>
            percept.skin/report
          </span>
          <a href="/perceptgpt" className="pv-gpt-link" style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="pv-gpt-text">Ask PerceptGPT</span> →
          </a>
        </div>

        {/* Tabs */}
        <div className="pv-tabs" style={{ display: "flex", gap: "0.4rem", padding: "1.2rem 1.6rem 0" }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.7rem",
                  padding: "1rem 1.4rem", borderRadius: "1.2rem 1.2rem 0 0",
                  background: isActive ? "var(--bg-neutral)" : "transparent",
                  color: isActive ? "var(--ink)" : "var(--ink-secondary)",
                  fontSize: "1.25rem", fontWeight: 500, whiteSpace: "nowrap",
                  borderBottom: isActive ? `2px solid ${t.accent}` : "2px solid transparent",
                }}
              >
                <Icon size={1.4} strokeWidth={2} />
                <span className="pv-tab-label">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div style={{ background: "var(--bg-neutral)", padding: "2.4rem", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", gap: "2.4rem" }} className="pv-panel">
          <div style={{ position: "relative", borderRadius: "1.4rem", overflow: "hidden", aspectRatio: "4/5" }}>
            <Image src={image} alt="" fill sizes="(max-width: 700px) 100vw, 40vw" style={{ objectFit: "cover" }} />
            <div style={{ position: "absolute", top: "1.4rem", left: "1.4rem", background: "rgba(255,255,255,0.92)", borderRadius: "1.4rem", padding: "0.8rem" }}>
              <ScoreRing value={tab === "skin" ? 84 : tab === "colour" ? 91 : tab === "hairstyle" ? 78 : 88} size={72} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.6rem" }}>
            {tab === "colour" ? (
              <>
                <div style={{ fontSize: "1.3rem", color: "var(--ink-secondary)" }}>Autumn · Warm undertone · High contrast</div>
                <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
                  {COLOUR_SWATCHES.map((c) => (
                    <span key={c} style={{ width: "3.2rem", height: "3.2rem", borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,0.08)" }} />
                  ))}
                </div>
              </>
            ) : tab === "hairstyle" || tab === "frame" ? (
              <div style={{ fontSize: "1.3rem", color: "var(--ink-secondary)", lineHeight: 1.6 }}>
                {tab === "hairstyle"
                  ? "Styles rendered on your own photo, matched to your face shape."
                  : "Frames matched to your face geometry and colour season, previewed on you."}
              </div>
            ) : (
              SKIN_METRICS.map((m) => <MetricBar key={m.name} name={m.name} score={m.score} accent={active.accent} />)
            )}
            {tab === "skin" && (
              <div style={{ paddingTop: "0.8rem", borderTop: "1px solid var(--border-neutral)" }}>
                {HARMONY_METRICS.slice(0, 2).map((m) => (
                  <div key={m.name} style={{ marginBottom: "1rem" }}>
                    <MetricBar name={m.name} score={m.score} accent="#8C9B97" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .pv-tab-label { display: inline; }
        @media (max-width: 700px) {
          .pv-panel { grid-template-columns: 1fr !important; }
          .pv-tab-label { display: none; }
        }
        @media (max-width: 560px) {
          .pv-gpt-text { display: none; }
        }
      `}</style>
    </div>
  );
}
