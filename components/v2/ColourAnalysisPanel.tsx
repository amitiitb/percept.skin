"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ColourGrid } from "@/components/v2/ColourGrid";
import type { ColourAnalysis, ColourSwatch } from "@/lib/v2/types";
import { IconCheck } from "@/components/ui/icons";
import { GenerationLoader } from "@/components/v2/GenerationLoader";

interface Props {
  sessionId: string;
  photo: string | null;
  initialAnalysis?: ColourAnalysis | null;
}

// Chips, not a grid of large squares. The old version gave every shade a full
// tile with name and hex stacked underneath, so a 12-colour palette alone ran
// most of a screen. A swatch dot plus its name carries the same information in
// a fraction of the height.
function SwatchRow({ title, items }: { title: string; items: ColourSwatch[] }) {
  return (
    <div style={{ marginBottom: "1.8rem" }}>
      <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", margin: "0 0 0.9rem" }}>{title}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {items.map((c, i) => (
          <span
            key={c.hex + i}
            title={c.hex.toUpperCase()}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.6rem", background: "var(--canvas)",
              border: "1px solid var(--line)", borderRadius: "9999px", padding: "0.5rem 1rem 0.5rem 0.5rem",
            }}
          >
            <span style={{ width: "1.6rem", height: "1.6rem", borderRadius: "50%", background: c.hex, border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
            <span style={{ fontSize: "1.25rem", color: "var(--primary)", whiteSpace: "nowrap" }}>{c.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Every section is a numbered, boxed "chapter" — bold badge + label above a card
// with its own background — so the report reads as a printed reference document,
// not a thin-divider AI-tool output.
function Section({ title, subtitle, children, tone = "surface" }: { title: string; subtitle?: string; children: React.ReactNode; tone?: "surface" | "wash" }) {
  return (
    <div style={{ marginTop: "2rem" }}>
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
      const res = await fetch("/api/colour-analysis", {
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
      <div>
        <h2 style={{ fontSize: "2.2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "1rem" }}>Your Colour Analysis</h2>
        <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2rem", lineHeight: 1.5 }}>
          Discover your seasonal palette, best clothing colours, colours to avoid, and best metal tone, personalised to your skin tone.
        </p>
        {error ? (
          <div style={{ textAlign: "center", padding: "2.4rem", border: "1px solid var(--line)", borderRadius: "1.2rem", background: "var(--surface)" }}>
            <p style={{ color: "var(--rose)", fontSize: "1.4rem", marginBottom: "1.6rem" }}>{error}</p>
            <PrimaryButton fullWidth={false} onClick={fetchAnalysis}>Try again</PrimaryButton>
          </div>
        ) : <GenerationLoader kind="colour" title={loading ? "Analysing your colouring…" : "Preparing your colour analysis…"} detail="Finding your season, palette and best clothing colours." />}
      </div>
    );
  }

  const metalLabel = analysis.metal_recommendation === "rose_gold" ? "Rose Gold"
    : analysis.metal_recommendation.charAt(0).toUpperCase() + analysis.metal_recommendation.slice(1);
  const contrastLabel = analysis.contrast_level.charAt(0).toUpperCase() + analysis.contrast_level.slice(1);
  const undertoneLabel = analysis.undertone.charAt(0).toUpperCase() + analysis.undertone.slice(1);

  const takeaway = `You look strongest in ${analysis.sub_season.toLowerCase()}, ${undertoneLabel.toLowerCase()}-toned clothing. These colours support your natural depth, make your complexion appear clearer, and create a balanced, confident appearance.`;

  return (
    <div>

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

      {/* Was seven numbered sections (summary, drapes, best, avoid, neutrals,
          metals, guidance), each a full boxed card. That is reference-manual
          pacing for what is really three ideas: here is your season, here is
          you wearing it, here are the shades. Consolidated to three. */}

      {/* ── 1. At a glance ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", marginBottom: "2.4rem" }}>
        {[
          { label: "Season", value: analysis.season },
          { label: "Undertone", value: undertoneLabel },
          { label: "Contrast", value: contrastLabel },
          { label: "Metal", value: metalLabel },
        ].map((a) => (
          <div key={a.label} style={{ display: "inline-flex", alignItems: "baseline", gap: "0.6rem", background: "var(--wash)", borderRadius: "9999px", padding: "0.8rem 1.6rem" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{a.label}</span>
            <span style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--primary)" }}>{a.value}</span>
          </div>
        ))}
      </div>

      {/* ── 2. You, wearing it ── */}
      <Section title="How These Colours Look On You" subtitle={`Your ${analysis.sub_season} palette, on your own photo.`}>
        <ColourGrid sessionId={sessionId} photo={photo} analysis={analysis} />
      </Section>

      {/* ── 3. The palette: wear / avoid / neutrals in one card ── */}
      <Section title="Your Palette">
        <SwatchRow title="Wear these" items={analysis.best_colours} />
        {analysis.worst_colours.length > 0 && <SwatchRow title="Avoid these" items={analysis.worst_colours} />}
        {analysis.neutrals.length > 0 && <SwatchRow title="Neutrals that always work" items={analysis.neutrals} />}
        <p style={{ fontSize: "1.3rem", color: "var(--muted)", margin: "1.8rem 0 0", lineHeight: 1.5 }}>
          {analysis.metal_reason}
        </p>
      </Section>

      {/* ── Style guidance, compact ── */}
      {analysis.clothing_tips.length > 0 && (
        <div style={{ marginTop: "2rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2.4rem 2.8rem" }}>
          <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 1.4rem" }}>Quick style guidance</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {analysis.clothing_tips.slice(0, 4).map((t, i) => (
              <p key={i} style={{ display: "flex", gap: "0.9rem", fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.5, margin: 0 }}>
                <span aria-hidden style={{ color: "var(--rose)", flexShrink: 0, display: "flex", marginTop: "0.2rem" }}><IconCheck size={1.5} strokeWidth={2.4} /></span>{t}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Final takeaway ── */}
      <div style={{ marginTop: "2rem", background: "var(--panel)", borderRadius: "1.6rem", padding: "3.2rem", textAlign: "center" }}>
        <p style={{ fontSize: "1.8rem", fontWeight: 700, color: "#fff", lineHeight: 1.55, maxWidth: "72rem", margin: "0 auto" }}>{takeaway}</p>
      </div>
      <p style={{ fontSize: "1.2rem", color: "var(--muted)", textAlign: "center", marginTop: "1.4rem" }}>
        Best-fit analysis based on your uploaded photo. Lighting and camera processing may affect the result.
      </p>

    </div>
  );
}
