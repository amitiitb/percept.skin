"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SuitsYouDraping, AvoidDraping } from "@/components/v2/ColourDraping";
import type { ColourAnalysis, ColourSwatch } from "@/lib/v2/types";

interface Props {
  sessionId: string;
  photo: string | null;
  initialAnalysis?: ColourAnalysis | null;
}

function SwatchGrid({ items }: { items: ColourSwatch[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))", gap: "1.4rem" }}>
      {items.map((c, i) => (
        <div key={c.hex + i} style={{ textAlign: "center" }}>
          <div style={{ width: "100%", aspectRatio: "1", borderRadius: "1rem", background: c.hex, border: "1px solid var(--line)", marginBottom: "0.8rem", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }} />
          <p style={{ fontSize: "1.3rem", color: "var(--primary)", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{c.name}</p>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", margin: "0.2rem 0 0" }}>{c.hex.toUpperCase()}</p>
        </div>
      ))}
    </div>
  );
}

// Every section is a numbered, boxed "chapter" — bold badge + label above a card
// with its own background — so the report reads as a printed reference document,
// not a thin-divider AI-tool output.
function Section({ number, title, subtitle, children, tone = "surface" }: { number: number; title: string; subtitle?: string; children: React.ReactNode; tone?: "surface" | "wash" }) {
  return (
    <div style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", marginBottom: "1.8rem" }}>
        <span style={{ width: "3.2rem", height: "3.2rem", flexShrink: 0, borderRadius: "0.7rem", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 700 }}>
          {number}
        </span>
        <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.14em", margin: 0 }}>Section {number}</p>
      </div>
      <div style={{ background: tone === "wash" ? "var(--wash)" : "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem" }}>
        <h2 style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--primary)", margin: "0 0 0.6rem", letterSpacing: "-0.01em" }}>{title}</h2>
        {subtitle && <p style={{ fontSize: "1.5rem", color: "var(--secondary)", margin: "0 0 2.4rem", lineHeight: 1.5 }}>{subtitle}</p>}
        {!subtitle && <div style={{ marginBottom: "2rem" }} />}
        {children}
      </div>
    </div>
  );
}

export default function ColourAnalysisPanel({ sessionId, photo, initialAnalysis }: Props) {
  const supabase = createClient();
  const [analysis, setAnalysis] = useState<ColourAnalysis | null>(initialAnalysis ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAnalysis() {
    if (!photo) { setError("No front-face photo available for this scan."); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await fetch("/api/v2/colour-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, photoDataUrl: photo }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed");
      setAnalysis(((await res.json()) as { analysis: ColourAnalysis }).analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!analysis) {
    return (
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "4rem", marginTop: "3.2rem" }}>
        <h2 style={{ fontSize: "2.2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "1rem" }}>Your Colour Analysis</h2>
        <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2rem", lineHeight: 1.5 }}>
          Discover your seasonal palette, best clothing colours, colours to avoid, and best metal tone — personalised to your skin tone.
        </p>
        {error && <p style={{ color: "var(--rose)", fontSize: "1.4rem", marginBottom: "1.6rem" }}>{error}</p>}
        <PrimaryButton fullWidth={false} onClick={fetchAnalysis} loading={loading}>Get My Colour Analysis →</PrimaryButton>
      </div>
    );
  }

  const metalLabel = analysis.metal_recommendation === "rose_gold" ? "Rose Gold"
    : analysis.metal_recommendation.charAt(0).toUpperCase() + analysis.metal_recommendation.slice(1);
  const contrastLabel = analysis.contrast_level.charAt(0).toUpperCase() + analysis.contrast_level.slice(1);
  const undertoneLabel = analysis.undertone.charAt(0).toUpperCase() + analysis.undertone.slice(1);

  const takeaway = `You look strongest in ${analysis.sub_season.toLowerCase()}, ${undertoneLabel.toLowerCase()}-toned clothing. These colours support your natural depth, make your complexion appear clearer, and create a balanced, confident appearance.`;

  let sn = 0;

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "4rem", marginTop: "3.2rem" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: "2.4rem" }}>
        <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "0.8rem" }}>
          Your Personal Colour Analysis
        </p>
        <h2 style={{ fontSize: "clamp(2.8rem, 4vw, 3.6rem)", fontWeight: 700, color: "var(--primary)", margin: "0 0 0.8rem", letterSpacing: "-0.01em" }}>
          Best fit: {analysis.sub_season}
        </h2>
        <p style={{ fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.6, maxWidth: "68rem" }}>{analysis.description}</p>
      </div>

      {/* ── Colour summary ── */}
      <Section number={++sn} title="Colour Summary" tone="wash">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            { label: "Season", value: analysis.season },
            { label: "Undertone", value: undertoneLabel },
            { label: "Contrast", value: contrastLabel },
            { label: "Best metal", value: metalLabel },
          ].map((a, i, arr) => (
            <div key={a.label} style={{ display: "flex", justifyContent: "space-between", gap: "1.6rem", padding: "1.4rem 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)" }}>{a.label}</span>
              <span style={{ fontSize: "1.5rem", color: "var(--secondary)" }}>{a.value}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Colours that suit you (draped) ── */}
      <Section number={++sn} title="How These Colours Look On You" subtitle={`Your ${analysis.sub_season} palette, draped on your own photo.`}>
        <SuitsYouDraping photo={photo} analysis={analysis} />
      </Section>

      {/* ── Colours to avoid (draped) ── */}
      {analysis.worst_colours.length > 0 && (
        <Section number={++sn} title="Colours To Avoid On You" subtitle="These tones tend to wash you out or fight your natural colouring.">
          <AvoidDraping photo={photo} analysis={analysis} />
        </Section>
      )}

      {/* ── Best colours to wear — swatch reference ── */}
      <Section number={++sn} title="Best Colours to Wear">
        <SwatchGrid items={analysis.best_colours} />
        <p style={{ fontSize: "1.4rem", color: "var(--muted)", marginTop: "1.8rem", lineHeight: 1.5 }}>
          Choose rich, {analysis.undertone === "cool" ? "cool" : "warm"} shades rather than the ones below.
        </p>
      </Section>

      {/* ── Colours to limit or avoid — swatch reference ── */}
      {analysis.worst_colours.length > 0 && (
        <Section number={++sn} title="Colours to Limit or Avoid">
          <SwatchGrid items={analysis.worst_colours} />
          <p style={{ fontSize: "1.4rem", color: "var(--muted)", marginTop: "1.8rem", lineHeight: 1.5 }}>
            These shades may compete with your natural {analysis.undertone} colouring.
          </p>
        </Section>
      )}

      {/* ── Best neutrals ── */}
      {analysis.neutrals.length > 0 && (
        <Section number={++sn} title="Best Neutrals" subtitle="Reliable base tones that work with everything above.">
          <SwatchGrid items={analysis.neutrals} />
        </Section>
      )}

      {/* ── Metals & accessories ── */}
      <Section number={++sn} title="Metals & Accessories" tone="wash">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
          <div>
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: "0 0 0.3rem" }}>Best metal: {metalLabel}</p>
            <p style={{ fontSize: "1.4rem", color: "var(--secondary)", margin: 0, lineHeight: 1.5 }}>{analysis.metal_reason}</p>
          </div>
        </div>
      </Section>

      {/* ── Style guidance ── */}
      <Section number={++sn} title="Quick Style Guidance">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
          {analysis.clothing_tips.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: "1.4rem", fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.5 }}>
              <span style={{ width: "2.6rem", height: "2.6rem", flexShrink: 0, borderRadius: "50%", background: "var(--primary)", color: "#fff", fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              {t}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Final takeaway ── */}
      <div style={{ marginTop: "2rem", background: "var(--primary)", borderRadius: "1.6rem", padding: "3.2rem", textAlign: "center" }}>
        <p style={{ fontSize: "1.8rem", fontWeight: 700, color: "#fff", lineHeight: 1.55, maxWidth: "72rem", margin: "0 auto" }}>{takeaway}</p>
      </div>
      <p style={{ fontSize: "1.2rem", color: "var(--muted)", textAlign: "center", marginTop: "1.4rem" }}>
        Best-fit analysis based on your uploaded photo. Lighting and camera processing may affect the result.
      </p>

      <div style={{ textAlign: "center", marginTop: "3.2rem" }}>
        <PrimaryButton fullWidth={false} variant="outline" onClick={fetchAnalysis} loading={loading}>
          ↻ Regenerate Analysis
        </PrimaryButton>
      </div>
    </div>
  );
}
