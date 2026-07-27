"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScoreReveal } from "@/components/v2/ScoreReveal";
import ColourAnalysisPanel from "@/components/v2/ColourAnalysisPanel";
import HairstylePanel from "@/components/v2/HairstylePanel";
import GlassesVirtualTryOn from "@/components/v2/GlassesVirtualTryOn";
import FrameAIPanel from "@/components/v2/FrameAIPanel";
import type { AnalysisMetric, MetricCategory, ColourAnalysis, RecommendationSet } from "@/lib/v2/types";
import type { ModuleId } from "@/lib/v2/reportModules";

interface SessionRow {
  id: string;
  status: string;
  overall_score: number | null;
  skin_age: number | null;
  created_at: string;
  positive_observations: string[] | null;
  recommendations: RecommendationSet | null;
  limitations: string[] | null;
}

function verdictFor(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Moderate";
  return "Needs attention";
}

function ScoreBar({ score }: { score: number | null }) {
  const pct = Math.max(2, Math.min(100, score ?? 0));
  return (
    <div style={{ flex: 1, height: "0.6rem", borderRadius: "9999px", background: "var(--line)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: "9999px", background: "var(--rose)" }} />
    </div>
  );
}

function MetricRow({ m }: { m: AnalysisMetric }) {
  return (
    <div style={{ padding: "1.8rem 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", marginBottom: "0.8rem" }}>
        <span style={{ fontSize: "1.5rem", color: "var(--primary)", fontWeight: 500, flex: "0 0 auto", minWidth: "15rem" }}>{m.metricName}</span>
        <ScoreBar score={m.score} />
        <span style={{ fontSize: "1.5rem", color: "var(--secondary)", fontWeight: 500, width: "3.2rem", textAlign: "right", flexShrink: 0 }}>{m.score ?? "—"}</span>
      </div>
      <p style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.6, margin: 0 }}>{m.explanation}</p>
    </div>
  );
}

function Section({ title, intro, metrics }: { title: string; intro?: string; metrics: AnalysisMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div style={{ marginBottom: "4.8rem" }}>
      <h2 style={{ fontSize: "2.2rem", fontWeight: 500, color: "var(--primary)", marginBottom: intro ? "0.6rem" : "1.6rem" }}>{title}</h2>
      {intro && <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2rem", maxWidth: "60rem" }}>{intro}</p>}
      <div className="v2-metric-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 4.8rem" }}>
        {metrics.map((m) => <MetricRow key={m.metricName} m={m} />)}
      </div>
    </div>
  );
}

const SECTION_INTRO: Record<string, string> = {
  Skin: "Texture, tone, and hydration across your face, read from your guided photos.",
  Face: "Proportion, symmetry, and structural balance — the framework the rest of your look sits on.",
  "Hair & Scalp": "Density, hairline pattern, and overall scalp health from your part and crown shots.",
};

const ROUTINE_META: Array<{ key: keyof RecommendationSet; label: string; icon: string; gate: "skin" | "hair" }> = [
  { key: "morning", label: "Morning", icon: "☀", gate: "skin" },
  { key: "evening", label: "Evening", icon: "☾", gate: "skin" },
  { key: "weekly", label: "Weekly", icon: "✦", gate: "skin" },
  { key: "hairScalp", label: "Hair & Scalp", icon: "≈", gate: "hair" },
];

export default function V2ReportPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [metrics, setMetrics] = useState<AnalysisMetric[]>([]);
  const [purchased, setPurchased] = useState<Set<ModuleId> | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [colourAnalysis, setColourAnalysis] = useState<ColourAnalysis | null>(null);

  async function load(): Promise<string | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace(`/auth/login?next=/v2/report/${sessionId}`); return; }

    const [{ data: sess }, { data: purchase }, { data: metricRows }, { data: photoRow }, { data: colourRow }] = await Promise.all([
      supabase.from("analysis_sessions_v2").select("id, status, overall_score, skin_age, created_at").eq("id", sessionId).eq("user_id", user.id).maybeSingle(),
      supabase.from("report_purchases_v2").select("modules").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
      supabase.from("analysis_metrics_v2").select("category, metric_name, score, label, confidence, explanation, recommendation, is_premium").eq("session_id", sessionId).eq("user_id", user.id),
      supabase.from("analysis_photos_v2").select("storage_path").eq("session_id", sessionId).eq("user_id", user.id).eq("photo_type", "face_front").maybeSingle(),
      supabase.from("colour_analysis_v2").select("data").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
    ]);

    if (!sess) { setNotFound(true); setLoading(false); return; }

    // Bundle-first model: no purchase record means nothing was ever bought
    // for this scan — send back to the purchase screen rather than showing
    // an empty report.
    if (!purchase) { router.replace(`/v2/bundle/${sessionId}`); return; }

    // Separate, best-effort fetch for the richer report content — kept apart
    // from the core session query above so a pre-migration environment
    // (columns not added yet, see supabase/migrations/20260727000000_*.sql)
    // degrades to "no routine/observations shown" instead of breaking the
    // entire report page with a 400 on an unknown column.
    let content: Pick<SessionRow, "positive_observations" | "recommendations" | "limitations"> = {
      positive_observations: null, recommendations: null, limitations: null,
    };
    try {
      const { data: contentRow, error: contentErr } = await supabase
        .from("analysis_sessions_v2").select("positive_observations, recommendations, limitations")
        .eq("id", sessionId).eq("user_id", user.id).maybeSingle();
      if (contentErr) throw contentErr;
      if (contentRow) content = contentRow;
    } catch {
      // Columns not present yet — content stays empty, rest of the report renders normally.
    }

    setSession({ ...sess, ...content });
    setPurchased(new Set(purchase.modules as ModuleId[]));
    setMetrics((metricRows ?? []).map((r) => ({
      category: r.category as MetricCategory, metricName: r.metric_name, score: r.score,
      label: r.label as AnalysisMetric["label"], confidence: r.confidence, explanation: r.explanation,
      recommendation: r.recommendation, isPremium: r.is_premium,
    })));
    setColourAnalysis((colourRow?.data as ColourAnalysis) ?? null);

    if (photoRow?.storage_path) {
      const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(photoRow.storage_path, 60 * 60 * 24 * 7);
      setPhoto(signed?.signedUrl ?? null);
    }

    setLoading(false);
    return sess.status;
  }

  useEffect(() => {
    load();
  }, [sessionId]);

  // Real analysis (Claude vision over 7 photos) takes ~60-100s. A user can
  // reach this page before it finishes — e.g. background-kicked analysis on
  // the bundle page hasn't caught up with a fast checkout. Poll instead of
  // dead-ending on "still processing" with no way to know it'll resolve.
  useEffect(() => {
    if (!session || session.status === "complete") return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const status = await load();
      if (status === "complete" || attempts >= 20) clearInterval(interval);
    }, 4000);
    return () => clearInterval(interval);
  }, [session?.status, sessionId]);

  if (loading || !purchased) return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;
  if (notFound) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem" }}>
        <p style={{ fontSize: "1.8rem", color: "var(--secondary)" }}>Report not found or you don&apos;t have access.</p>
        <PrimaryButton fullWidth={false} onClick={() => router.push("/v2/dashboard")}>Back to dashboard</PrimaryButton>
      </div>
    );
  }
  if (session?.status !== "complete") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem" }}>
        <div style={{ width: "3.2rem", height: "3.2rem", borderRadius: "50%", border: "3px solid var(--line)", borderTopColor: "var(--primary)", animation: "v2-spin 1s linear infinite" }} />
        <p style={{ fontSize: "1.8rem", color: "var(--secondary)", textAlign: "center", maxWidth: "36rem" }}>Your analysis is still finishing up. This page will update automatically, usually within a minute or two.</p>
        <PrimaryButton fullWidth={false} onClick={() => router.push("/v2/dashboard")}>Back to dashboard</PrimaryButton>
        <style>{`@keyframes v2-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // "Skin Analysis" module includes the Face metric category; "Hairstyle
  // Recommendations" includes the Hair & Scalp metric category — both merges
  // decided during the bundle-flow build so no metric category is orphaned
  // outside the 4 purchasable modules.
  const hasSkin = purchased.has("skin");
  const hasColour = purchased.has("colour");
  const hasHairstyle = purchased.has("hairstyle");
  const hasFrame = purchased.has("frame");

  const skinMetrics = hasSkin ? metrics.filter((m) => m.category === "skin") : [];
  const faceMetrics = hasSkin ? metrics.filter((m) => m.category === "face") : [];
  const hairMetrics = hasHairstyle ? metrics.filter((m) => m.category === "hair") : [];
  const score = session.overall_score ?? 0;

  // /api/v2/analyse always computes skin+face+hair metrics regardless of what
  // was purchased (analysis kicks off before purchase, in the bundle-page
  // background fetch). The summary strip must only surface categories the
  // user actually paid for, or it leaks metric names from unpurchased modules.
  const purchasedCategories = new Set<MetricCategory>([
    ...(hasSkin ? (["skin", "face"] as MetricCategory[]) : []),
    ...(hasHairstyle ? (["hair"] as MetricCategory[]) : []),
  ]);
  const sorted = metrics
    .filter((m) => purchasedCategories.has(m.category))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const strongest = sorted.slice(0, 3).map((m) => m.metricName);
  const priority = sorted.slice(-3).map((m) => m.metricName);

  // positiveObservations/limitations/recommendations are generated from
  // whatever photos existed at analysis time, not tagged per module — only
  // show them if the user actually bought at least one of skin/hairstyle
  // (same access boundary the metric sections use).
  const hasContentAccess = hasSkin || hasHairstyle;
  const positiveObservations = hasContentAccess ? (session.positive_observations ?? []) : [];
  const limitations = hasContentAccess ? (session.limitations ?? []) : [];
  const recommendations = hasContentAccess ? session.recommendations : null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
      <div style={{ maxWidth: "108rem", margin: "0 auto" }}>

        <button
          onClick={() => router.push("/v2/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", padding: 0, marginBottom: "3.2rem" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Dashboard
        </button>

        {/* Hero — portrait + Glow Score side by side (Design review Decision #12,
            extended with the user's own photo so the payoff moment feels like a
            personal consultation, not a bare number) */}
        <div className="v2-hero-grid" style={{ display: "grid", gridTemplateColumns: photo ? "30rem 1fr" : "1fr", gap: "4.8rem", alignItems: "center", marginBottom: "3.2rem" }}>
          {photo && (
            <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: "2rem", overflow: "hidden", boxShadow: "0 2.4rem 4.8rem -1.2rem rgba(0,57,52,0.28)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Your guided-capture photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <div style={{ textAlign: photo ? "left" : "center" }}>
            <div style={{ margin: photo ? "0" : "0 auto" }}>
              <ScoreReveal score={score} />
            </div>
            <p style={{ fontSize: "2rem", color: "var(--secondary)", marginTop: "1.6rem" }}>{verdictFor(score)} · Glow Score</p>
            {session.skin_age !== null && (
              <p style={{ fontSize: "1.5rem", color: "var(--muted)", marginTop: "1.2rem" }}>Estimated skin age: {session.skin_age}</p>
            )}
            {sorted.length > 0 && (
              <div style={{ display: "flex", gap: "3.2rem", justifyContent: photo ? "flex-start" : "center", marginTop: "2.4rem", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Strongest</p>
                  <p style={{ fontSize: "1.5rem", color: "var(--primary)" }}>{strongest.join(" · ")}</p>
                </div>
                <div>
                  <p style={{ fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Priority areas</p>
                  <p style={{ fontSize: "1.5rem", color: "var(--primary)" }}>{priority.join(" · ")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* What's working well — the AI's positive observations, previously
            generated on every analysis but never surfaced anywhere. */}
        {positiveObservations.length > 0 && (
          <div style={{ background: "var(--primary)", borderRadius: "1.6rem", padding: "3.2rem 3.6rem", marginBottom: "4.8rem" }}>
            <p style={{ fontSize: "1.2rem", color: "var(--on-dark)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "1.8rem", opacity: 0.8 }}>What&apos;s working well</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              {positiveObservations.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "1.2rem", alignItems: "flex-start" }}>
                  <span style={{ color: "var(--rose)", fontSize: "1.6rem", flexShrink: 0, lineHeight: 1.6 }}>✦</span>
                  <p style={{ fontSize: "1.6rem", color: "#fff", lineHeight: 1.6, margin: 0 }}>{p}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Only purchased modules render — no locked/empty sections (bundle-first model) */}
        {hasSkin && <Section title="Skin" intro={SECTION_INTRO.Skin} metrics={skinMetrics} />}
        {hasSkin && <Section title="Face" intro={SECTION_INTRO.Face} metrics={faceMetrics} />}
        {hasHairstyle && <Section title="Hair & Scalp" intro={SECTION_INTRO["Hair & Scalp"]} metrics={hairMetrics} />}

        {/* Personalized routine — real morning/evening/weekly/hair-scalp guidance
            from the same analysis call, previously computed and discarded. */}
        {recommendations && (
          <div style={{ marginBottom: "4.8rem" }}>
            <h2 style={{ fontSize: "2.2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.6rem" }}>Your Personalized Routine</h2>
            <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2rem", maxWidth: "60rem" }}>Based on what we saw in your photos and the concerns you shared.</p>
            <div className="v2-routine-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6rem" }}>
              {ROUTINE_META.filter((r) => (r.gate === "skin" ? hasSkin : hasHairstyle)).map(({ key, label, icon }) => {
                const steps = recommendations?.[key];
                if (!steps?.length) return null;
                return (
                  <div key={key} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2.8rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.8rem" }}>
                      <span style={{ fontSize: "1.8rem", color: "var(--rose)" }}>{icon}</span>
                      <h3 style={{ fontSize: "1.7rem", fontWeight: 500, color: "var(--primary)", margin: 0 }}>{label}</h3>
                    </div>
                    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                      {steps.map((s, i) => (
                        <li key={i} style={{ display: "flex", gap: "1rem", fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.55 }}>
                          <span style={{ color: "var(--rose)", fontWeight: 600, flexShrink: 0 }}>{i + 1}.</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasColour && <ColourAnalysisPanel sessionId={sessionId} photo={photo} initialAnalysis={colourAnalysis} />}

        {hasFrame && photo && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "4rem", marginTop: "3.2rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.8rem" }}>Frames For Your Face</h2>
            <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2.4rem", lineHeight: 1.5 }}>
              Try on frames matched to your face shape{colourAnalysis ? " and colour season" : ""}.
            </p>
            <GlassesVirtualTryOn photoUrl={photo} seasonalColour={colourAnalysis?.season ?? null} />
            <FrameAIPanel sessionId={sessionId} photo={photo} isPremium onRequirePremium={() => {}} />
          </div>
        )}

        {hasHairstyle && (
          <HairstylePanel
            sessionId={sessionId}
            photo={photo}
            isPremium // purchased = unlocked, no further gate
            onRequirePremium={() => {}}
          />
        )}

        {limitations.length > 0 && (
          <div style={{ marginTop: "3.2rem", padding: "2.4rem 2.8rem", background: "var(--wash)", borderRadius: "1.2rem" }}>
            <p style={{ fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>Good to know</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {limitations.map((l, i) => <li key={i} style={{ fontSize: "1.3rem", color: "var(--secondary)", lineHeight: 1.6 }}>{l}</li>)}
            </ul>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "4.8rem" }}>
          <PrimaryButton fullWidth={false} variant="outline" onClick={() => router.push(`/v2/report/${sessionId}/print`)}>
            Download report →
          </PrimaryButton>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .v2-metric-cols { grid-template-columns: 1fr !important; }
          .v2-hero-grid { grid-template-columns: 1fr !important; }
          .v2-hero-grid > div:first-child { max-width: 24rem; margin: 0 auto; }
        }
        @media (max-width: 600px) {
          .v2-routine-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
