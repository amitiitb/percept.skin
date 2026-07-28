"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
        <span style={{ fontSize: "1.5rem", color: "var(--secondary)", fontWeight: 500, width: "3.2rem", textAlign: "right", flexShrink: 0 }}>{m.score ?? "-"}</span>
      </div>
      <p style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.6, margin: 0 }}>{m.explanation}</p>
    </div>
  );
}

// Pre-purchase teaser row — real metric name (what was measured), score/bar
// blurred behind a lock (real proportions still faintly visible, exact value
// not readable), no explanation. The data itself already exists for every
// scan regardless of purchase (analyse runs before checkout) — this is a
// rendering-only gate, nothing new computed or stored.
function LockedMetricRow({ m }: { m: AnalysisMetric }) {
  return (
    <div style={{ padding: "1.8rem 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
        <span style={{ fontSize: "1.5rem", color: "var(--primary)", fontWeight: 500, flex: "0 0 auto", minWidth: "15rem" }}>{m.metricName}</span>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", gap: "1.6rem" }}>
          <div style={{ filter: "blur(5px)", display: "flex", alignItems: "center", gap: "1.6rem", flex: 1, userSelect: "none" }} aria-hidden>
            <ScoreBar score={m.score} />
            <span style={{ fontSize: "1.5rem", color: "var(--secondary)", fontWeight: 500, width: "3.2rem", textAlign: "right", flexShrink: 0 }}>{m.score ?? "-"}</span>
          </div>
          <span style={{ position: "absolute", right: "3.2rem", fontSize: "1.3rem" }} aria-label="Locked">🔒</span>
        </div>
      </div>
    </div>
  );
}

// One accent per section, keyed by title (not index) so it stays fixed
// regardless of which sections a given purchase actually renders.
const SECTION_ACCENT: Record<string, string> = {
  Skin: "var(--rose)",
  Face: "#D9A62E",
  "Hair & Scalp": "#E8604F",
};

// How many metrics show before a section needs a "show more" toggle at all
// — the actual complaint this fixes: a section with 7-8 full explanations
// stacked made the whole report read as one long scroll. 3 up front is
// enough to give a real read on that section without opening anything.
const COLLAPSED_COUNT = 3;

function Section({ title, intro, metrics, locked }: { title: string; intro?: string; metrics: AnalysisMetric[]; locked?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (metrics.length === 0) return null;
  const accent = SECTION_ACCENT[title] ?? "var(--rose)";
  const hiddenCount = locked ? 0 : Math.max(0, metrics.length - COLLAPSED_COUNT);
  // Always just the first COLLAPSED_COUNT here — the rest render in the
  // AnimatePresence block below only, never both at once.
  const visible = hiddenCount > 0 ? metrics.slice(0, COLLAPSED_COUNT) : metrics;
  return (
    <div style={{
      marginBottom: "3.2rem", background: "var(--surface)", borderRadius: "1.6rem",
      borderTop: `0.4rem solid ${accent}`, padding: "3.2rem 3.2rem 2.4rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.2rem", flexWrap: "wrap", marginBottom: intro ? "0.6rem" : "2rem" }}>
        <h2 style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", margin: 0 }}>{title}</h2>
        <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {metrics.length} metric{metrics.length > 1 ? "s" : ""}
        </span>
      </div>
      {intro && <p style={{ fontSize: "1.4rem", color: "var(--secondary)", marginBottom: "2.4rem", maxWidth: "60rem" }}>{intro}</p>}
      <div className="v2-metric-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 4.8rem" }}>
        {visible.map((m) => locked ? <LockedMetricRow key={m.metricName} m={m} /> : <MetricRow key={m.metricName} m={m} />)}
      </div>
      <AnimatePresence initial={false}>
        {hiddenCount > 0 && expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="v2-metric-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 4.8rem" }}>
              {metrics.slice(COLLAPSED_COUNT).map((m) => <MetricRow key={m.metricName} m={m} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1.6rem", background: "none",
            border: "none", padding: 0, cursor: "pointer", fontSize: "1.4rem", fontWeight: 600, color: accent,
          }}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
          <span style={{ display: "inline-block", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
        </button>
      )}
    </div>
  );
}

// Same order/labels as lib/v2/captureSteps.ts (kept as a separate small map
// here rather than importing that module, which also pulls in capture-flow
// types not needed on this page).
const PHOTO_ORDER = ["face_front", "face_left", "face_right", "face_detail", "hairline_front", "scalp_crown", "hair_parting"];
const PHOTO_LABELS: Record<string, string> = {
  face_front: "Front face", face_left: "Left angle", face_right: "Right angle", face_detail: "Close-up",
  hairline_front: "Hairline", scalp_crown: "Crown", hair_parting: "Parting",
};

const SECTION_INTRO: Record<string, string> = {
  Skin: "Texture, tone, and hydration.",
  Face: "Proportion and symmetry.",
  "Hair & Scalp": "Density, hairline, and scalp health.",
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
  const [allPhotos, setAllPhotos] = useState<Array<{ photoType: string; url: string }>>([]);
  const [colourAnalysis, setColourAnalysis] = useState<ColourAnalysis | null>(null);

  async function load(): Promise<string | undefined> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace(`/auth/login?next=/report/${sessionId}`); return; }

    const [{ data: sess }, { data: purchase }, { data: metricRows }, { data: photoRows }, { data: colourRow }] = await Promise.all([
      supabase.from("analysis_sessions_v2").select("id, status, overall_score, skin_age, created_at").eq("id", sessionId).eq("user_id", user.id).maybeSingle(),
      supabase.from("report_purchases_v2").select("modules").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
      supabase.from("analysis_metrics_v2").select("category, metric_name, score, label, confidence, explanation, recommendation, is_premium").eq("session_id", sessionId).eq("user_id", user.id),
      supabase.from("analysis_photos_v2").select("photo_type, storage_path").eq("session_id", sessionId).eq("user_id", user.id),
      supabase.from("colour_analysis_v2").select("data").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
    ]);

    if (!sess) { setNotFound(true); setLoading(false); return; }

    // Bundle-first model: no purchase record means nothing was bought yet —
    // used to hard-redirect to the paywall here. Now renders a teaser instead
    // (real score + locked metric names, no explanations) so there's something
    // worth being curious about before asking for payment. purchased stays an
    // empty Set (not null) to distinguish "loaded, nothing bought" from "still
    // loading" — the render below branches on that.

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
    setPurchased(new Set((purchase?.modules ?? []) as ModuleId[]));
    setMetrics((metricRows ?? []).map((r) => ({
      category: r.category as MetricCategory, metricName: r.metric_name, score: r.score,
      label: r.label as AnalysisMetric["label"], confidence: r.confidence, explanation: r.explanation,
      recommendation: r.recommendation, isPremium: r.is_premium,
    })));
    setColourAnalysis((colourRow?.data as ColourAnalysis) ?? null);

    if (photoRows?.length) {
      const signedEntries = await Promise.all(
        photoRows.map(async (p) => {
          const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(p.storage_path, 60 * 60 * 24 * 7);
          return signed?.signedUrl ? { photoType: p.photo_type, url: signed.signedUrl } : null;
        }),
      );
      const signed = signedEntries.filter((e): e is { photoType: string; url: string } => e !== null);
      signed.sort((a, b) => PHOTO_ORDER.indexOf(a.photoType) - PHOTO_ORDER.indexOf(b.photoType));
      setAllPhotos(signed);
      setPhoto(signed.find((p) => p.photoType === "face_front")?.url ?? signed[0]?.url ?? null);
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
        <PrimaryButton fullWidth={false} onClick={() => router.push("/dashboard")}>Back to dashboard</PrimaryButton>
      </div>
    );
  }
  if (session?.status !== "complete") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem" }}>
        <div style={{ width: "3.2rem", height: "3.2rem", borderRadius: "50%", border: "3px solid var(--line)", borderTopColor: "var(--primary)", animation: "v2-spin 1s linear infinite" }} />
        <p style={{ fontSize: "1.8rem", color: "var(--secondary)", textAlign: "center", maxWidth: "36rem" }}>Your analysis is still finishing up. This page will update automatically, usually within a minute or two.</p>
        <PrimaryButton fullWidth={false} onClick={() => router.push("/dashboard")}>Back to dashboard</PrimaryButton>
        <style>{`@keyframes v2-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Nothing purchased yet, but analysis is done (it always runs before
  // checkout) — show the teaser instead of the old hard-redirect-to-paywall.
  if (purchased.size === 0) {
    const score = session.overall_score ?? 0;
    const skinMetrics = metrics.filter((m) => m.category === "skin");
    const faceMetrics = metrics.filter((m) => m.category === "face");
    const hairMetrics = metrics.filter((m) => m.category === "hair");
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
        <div style={{ maxWidth: "88rem", margin: "0 auto" }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", padding: 0, marginBottom: "3.2rem" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Dashboard
          </button>

          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            {photo && (
              <div style={{ position: "relative", width: "12rem", height: "15rem", borderRadius: "1.6rem", overflow: "hidden", margin: "0 auto 2.4rem", boxShadow: "0 1.6rem 3.2rem -1rem rgba(0,57,52,0.28)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Your guided-capture photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <ScoreReveal score={score} />
            <p style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--primary)", marginTop: "1.2rem" }}>{verdictFor(score)} · Glow Score</p>
            <p style={{ fontSize: "1.4rem", color: "var(--muted)", marginTop: "0.8rem" }}>This is real, from your own photos. The rest is still locked.</p>
          </div>

          <Section title="Skin" intro={SECTION_INTRO.Skin} metrics={skinMetrics} locked />
          <Section title="Face" intro={SECTION_INTRO.Face} metrics={faceMetrics} locked />
          <Section title="Hair & Scalp" intro={SECTION_INTRO["Hair & Scalp"]} metrics={hairMetrics} locked />

          <div style={{ background: "var(--primary)", borderRadius: "1.6rem", padding: "3.6rem", textAlign: "center", marginTop: "2.4rem" }}>
            <p style={{ fontSize: "2rem", fontWeight: 500, color: "#fff", marginBottom: "0.8rem" }}>Every score above is real and already computed</p>
            <p style={{ fontSize: "1.5rem", color: "rgba(255,255,255,0.7)", marginBottom: "2.4rem", maxWidth: "48rem", marginLeft: "auto", marginRight: "auto" }}>
              Unlock the exact numbers, what they mean, and your personalized routine.
            </p>
            <PrimaryButton fullWidth={false} onClick={() => router.push(`/bundle/${sessionId}`)}>Unlock full report →</PrimaryButton>
          </div>
        </div>
        <style>{`@media (max-width: 900px) { .v2-metric-cols { grid-template-columns: 1fr !important; } }`}</style>
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

  // /api/analyse always computes skin+face+hair metrics regardless of what
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
          onClick={() => router.push("/dashboard")}
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
            <p style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", marginTop: "1.6rem" }}>{verdictFor(score)} · Glow Score</p>
            {session.skin_age !== null && (
              <div style={{ display: "inline-flex", alignItems: "baseline", gap: "0.8rem", marginTop: "1.4rem", background: "var(--wash)", borderRadius: "9999px", padding: "0.8rem 1.8rem" }}>
                <span style={{ fontSize: "1.3rem", color: "var(--secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Skin age</span>
                <span style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--primary)" }}>{session.skin_age}</span>
              </div>
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

        {/* All 7 guided-capture photos — previously only face_front ever
            rendered anywhere on the report; the other 6 (angles, hairline,
            crown, parting) were captured but never shown back to the user. */}
        {allPhotos.length > 0 && (
          <div style={{ marginBottom: "4.8rem" }}>
            <p style={{ fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.4rem" }}>Your photos</p>
            <div style={{ display: "flex", gap: "1.2rem", overflowX: "auto", paddingBottom: "0.4rem" }}>
              {allPhotos.map((p) => (
                <div key={p.photoType} style={{ flex: "0 0 auto", width: "11rem" }}>
                  <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: "1rem", overflow: "hidden", border: "1px solid var(--line)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={PHOTO_LABELS[p.photoType] ?? p.photoType} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <p style={{ fontSize: "1.2rem", color: "var(--secondary)", marginTop: "0.6rem", textAlign: "center" }}>{PHOTO_LABELS[p.photoType] ?? p.photoType}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <PrimaryButton fullWidth={false} variant="outline" onClick={() => router.push(`/report/${sessionId}/print`)}>
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
