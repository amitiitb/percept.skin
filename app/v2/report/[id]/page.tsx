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
import type { AnalysisMetric, MetricCategory, ColourAnalysis } from "@/lib/v2/types";
import type { ModuleId } from "@/lib/v2/reportModules";

interface SessionRow {
  id: string;
  status: string;
  overall_score: number | null;
  skin_age: number | null;
  created_at: string;
}

function verdictFor(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Moderate";
  return "Needs attention";
}

function MetricCard({ m }: { m: AnalysisMetric }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.2rem", padding: "2.4rem" }}>
      <p style={{ fontSize: "1.3rem", color: "var(--muted)", margin: "0 0 0.8rem" }}>{m.metricName}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
        <strong style={{ fontSize: "3.2rem", fontWeight: 300, color: "var(--primary)" }}>{m.score}</strong>
        <span style={{ fontSize: "1.3rem", color: "var(--secondary)" }}>{m.label}</span>
      </div>
      <p style={{ fontSize: "1.4rem", color: "var(--secondary)", marginTop: "1.2rem", lineHeight: 1.5 }}>{m.explanation}</p>
    </div>
  );
}

function Section({ title, metrics }: { title: string; metrics: AnalysisMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div style={{ marginBottom: "3.2rem" }}>
      <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "1.6rem" }}>{title}</h2>
      <div className="v2-metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.6rem" }}>
        {metrics.map((m) => <MetricCard key={m.metricName} m={m} />)}
      </div>
    </div>
  );
}

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

    setSession(sess);
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

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
      <div style={{ maxWidth: "108rem", margin: "0 auto" }}>

        <button
          onClick={() => router.push("/v2/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", padding: 0, marginBottom: "2.4rem" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Dashboard
        </button>

        {/* Glow Score first — Design review Decision #12 */}
        <div style={{ textAlign: "center", marginBottom: "4.8rem" }}>
          <ScoreReveal score={score} />
          <p style={{ fontSize: "2rem", color: "var(--secondary)", marginTop: "1.6rem" }}>{verdictFor(score)} · Glow Score</p>
          {session.skin_age !== null && (
            <p style={{ fontSize: "1.5rem", color: "var(--muted)", marginTop: "1.2rem" }}>Estimated skin age: {session.skin_age}</p>
          )}
          {sorted.length > 0 && (
          <div style={{ display: "flex", gap: "3.2rem", justifyContent: "center", marginTop: "2.4rem", flexWrap: "wrap" }}>
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

        {/* Only purchased modules render — no locked/empty sections (bundle-first model) */}
        {hasSkin && <Section title="Skin" metrics={skinMetrics} />}
        {hasSkin && <Section title="Face" metrics={faceMetrics} />}
        {hasHairstyle && <Section title="Hair & Scalp" metrics={hairMetrics} />}

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

        <div style={{ textAlign: "center", marginTop: "4.8rem" }}>
          <PrimaryButton fullWidth={false} variant="outline" onClick={() => router.push(`/v2/report/${sessionId}/print`)}>
            Download report →
          </PrimaryButton>
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .v2-metric-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
