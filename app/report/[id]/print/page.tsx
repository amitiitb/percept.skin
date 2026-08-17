"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { AnalysisMetric, MetricCategory, ColourAnalysis, RecommendationSet } from "@/lib/v2/types";
import type { ModuleId } from "@/lib/v2/reportModules";

/**
 * The downloadable report.
 *
 * This used to print the metric names and their scores and nothing else, so a
 * bundle buyer who paid for colour, hairstyle and frame previews downloaded a
 * document containing none of them. Everything the on-screen report shows is
 * included here: the capture photos, every score with its explanation and next
 * step, the routine, and all three generated preview images.
 *
 * Printing waits for the images to load. Firing window.print() on a timer, as
 * before, produced a PDF with blank boxes where the previews should be.
 */

const PHOTO_ORDER = ["face_front", "face_left", "face_right", "face_detail", "hairline_front", "scalp_crown"];
const PHOTO_LABELS: Record<string, string> = {
  face_front: "Front face", face_left: "Left angle", face_right: "Right angle",
  face_detail: "Close-up", hairline_front: "Hairline", scalp_crown: "Crown",
};

const COLOUR_LABELS = ["Casual / friendly meet-up", "Travel day", "Everyday office", "Investor meeting", "Office party", "Wedding / festive"];
const HAIR_LABELS = ["Office", "Wedding / formal", "Everyday casual", "Evening party", "Short & low-maintenance", "Textured everyday"];
const BEARD_LABELS = ["Clean-shaven", "Light stubble", "Short boxed beard", "Full classic beard", "Goatee", "Mustache only"];
const FRAME_LABELS = ["Office", "Evening / party", "Formal & wedding", "Everyday casual", "Minimal rimless", "Sporty everyday"];

const CAPTION: React.CSSProperties = { fontSize: "1.05rem", color: "#666", margin: "0.5rem 0 0" };

function concise(text: string | null | undefined, max = 170) {
  if (!text) return "";
  const firstTwo = text.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join(" ").trim() ?? text.trim();
  if (firstTwo.length <= max) return firstTwo;
  return `${firstTwo.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function printBand(score: number | null) {
  if (score === null) return { label: "Not assessed", colour: "#65716D", tint: "#ECEFEE" };
  if (score >= 60) return { label: "Strong", colour: "#17633F", tint: "#E2F1E8" };
  if (score >= 40) return { label: "Watch", colour: "#9A6512", tint: "#FAF0D7" };
  return { label: "Needs attention", colour: "#A93636", tint: "#F8E5E3" };
}

function GridImage({ src, alt, labels }: { src: string; alt: string; labels: string[] }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ width: "100%", borderRadius: "0.6rem", display: "block" }} />
      <p style={{ ...CAPTION, lineHeight: 1.6 }}>Generated to cover: {labels.join(" · ")}</p>
    </>
  );
}

const ROUTINE_META: Array<{ key: keyof RecommendationSet; label: string; gate: "skin" | "hair" }> = [
  { key: "morning", label: "Morning", gate: "skin" },
  { key: "evening", label: "Evening", gate: "skin" },
  { key: "weekly", label: "Weekly", gate: "skin" },
  { key: "hairScalp", label: "Hair & scalp", gate: "hair" },
];

interface SessionRow {
  overall_score: number | null;
  skin_age: number | null;
  created_at: string;
  positive_observations: string[] | null;
  recommendations: RecommendationSet | null;
  limitations: string[] | null;
}

function reportFileBase(name: string, createdAt: string) {
  const safeName = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(createdAt)).replace(/\s+/g, "-");
  return ["Percept-Report", safeName, date].filter(Boolean).join("-");
}

export default function V2ReportPrintPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [session, setSession] = useState<SessionRow | null>(null);
  const [metrics, setMetrics] = useState<AnalysisMetric[]>([]);
  const [purchased, setPurchased] = useState<Set<ModuleId>>(new Set());
  const [photos, setPhotos] = useState<Array<{ type: string; url: string }>>([]);
  const [colour, setColour] = useState<ColourAnalysis | null>(null);
  const [images, setImages] = useState<{ colour?: string; hair?: string; beard?: string; frame?: string }>({});
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: profile }, { data: sess }, { data: metricRows }, { data: purchase }, { data: photoRows }, { data: colourRow }, { data: hairRows }, { data: beardRows }, { data: frameRows }] = await Promise.all([
        supabase.from("user_profiles_v2").select("name").eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_sessions_v2").select("overall_score, skin_age, created_at, positive_observations, recommendations, limitations").eq("id", sessionId).eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_metrics_v2").select("category, metric_name, score, label, explanation, recommendation, is_premium, confidence").eq("session_id", sessionId).eq("user_id", user.id),
        supabase.from("report_purchases_v2").select("modules").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_photos_v2").select("photo_type, storage_path").eq("session_id", sessionId).eq("user_id", user.id),
        supabase.from("colour_analysis_v2").select("data").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
        supabase.from("hairstyle_generations_v2").select("storage_path").eq("session_id", sessionId).eq("user_id", user.id).eq("style_name", "Style grid").order("created_at", { ascending: false }).limit(1),
        supabase.from("grooming_generations_v2").select("storage_path").eq("session_id", sessionId).eq("user_id", user.id).eq("kind", "beard").order("created_at", { ascending: false }).limit(1),
        supabase.from("frame_generations_v2").select("storage_path").eq("session_id", sessionId).eq("user_id", user.id).eq("frame_name", "Frame grid").order("created_at", { ascending: false }).limit(1),
      ]);
      setName(profile?.name ?? "");
      setSession(sess as SessionRow);
      setMetrics((metricRows ?? []).map((r) => ({
        category: r.category as MetricCategory, metricName: r.metric_name, score: r.score,
        label: r.label as AnalysisMetric["label"], confidence: r.confidence, explanation: r.explanation,
        recommendation: r.recommendation, isPremium: r.is_premium,
      })));
      setPurchased(new Set((purchase?.modules as ModuleId[]) ?? []));

      const analysis = (colourRow?.data as ColourAnalysis | undefined) ?? null;
      setColour(analysis);

      async function sign(path?: string | null) {
        if (!path) return undefined;
        const { data } = await supabase.storage.from("photos_v2").createSignedUrl(path, 60 * 60);
        return data?.signedUrl;
      }
      const signedPhotos = await Promise.all((photoRows ?? []).map(async (p) => ({
        type: p.photo_type as string, url: (await sign(p.storage_path as string)) ?? "",
      })));
      setPhotos(signedPhotos.filter((p) => p.url).sort((a, b) => PHOTO_ORDER.indexOf(a.type) - PHOTO_ORDER.indexOf(b.type)));

      const [colourUrl, hairUrl, beardUrl, frameUrl] = await Promise.all([
        sign(analysis?.drapings?.storagePath),
        sign(hairRows?.[0]?.storage_path as string | undefined),
        sign(beardRows?.[0]?.storage_path as string | undefined),
        sign(frameRows?.[0]?.storage_path as string | undefined),
      ]);
      setImages({ colour: colourUrl, hair: hairUrl, beard: beardUrl, frame: frameUrl });
      setLoading(false);
    });
  }, [sessionId, supabase]);

  const categoryAllowed = (cat: MetricCategory) =>
    (cat === "skin" || cat === "face") ? purchased.has("skin") : purchased.has("hairstyle");

  const fileBase = session ? reportFileBase(name, session.created_at) : "Percept-Report";

  // Browsers commonly use document.title as the suggested filename for
  // Print -> Save as PDF, so keep it aligned with the explicit PDF download.
  useEffect(() => {
    if (!session) return;
    const previous = document.title;
    document.title = fileBase;
    return () => { document.title = previous; };
  }, [fileBase, session]);

  const handlePrint = () => {
    window.print();
  };

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#F5F7F5" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const renderedHeight = canvas.height * pageWidth / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      let remaining = renderedHeight;
      let y = 0;
      pdf.addImage(imgData, "JPEG", 0, y, pageWidth, renderedHeight, undefined, "FAST");
      remaining -= pageHeight;
      while (remaining > 0) {
        y = remaining - renderedHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, y, pageWidth, renderedHeight, undefined, "FAST");
        remaining -= pageHeight;
      }
      pdf.save(`${fileBase}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !session) return <p style={{ padding: "4rem", fontFamily: "sans-serif" }}>Preparing your report…</p>;

  const hasSkin = purchased.has("skin");
  const hasHair = purchased.has("hairstyle");
  const hasColour = purchased.has("colour");
  const hasFrame = purchased.has("frame");
  const recs = session.recommendations;
  const visibleMetrics = metrics.filter((metric) => categoryAllowed(metric.category));
  const priorities = visibleMetrics.filter((metric) => metric.score !== null)
    .sort((a, b) => (a.score ?? 100) - (b.score ?? 100)).slice(0, 3);
  const strengths = visibleMetrics.filter((metric) => (metric.score ?? 0) >= 70)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);

  const H2: React.CSSProperties = { fontSize: "2rem", margin: "0 0 1.2rem", color: "#0D3028", letterSpacing: "-0.025em" };
  const BLOCK: React.CSSProperties = { marginBottom: "2rem", breakInside: "avoid" };

  return (
    <>
      <div className="no-print" style={{
        position: "fixed", top: "2rem", right: "2rem", display: "flex", gap: "1.2rem",
        background: "#fff", padding: "1.2rem", borderRadius: "1.2rem", boxShadow: "0 1rem 3rem rgba(0,0,0,0.1)",
        zIndex: 100
      }}>
        <button onClick={handlePrint} style={{
          padding: "0.8rem 1.6rem", borderRadius: "0.8rem", border: "1px solid #ccc", background: "#f9f9f9",
          fontSize: "1.4rem", fontWeight: 500, cursor: "pointer", color: "#333"
        }}>
          Print
        </button>
        <button onClick={downloadPdf} disabled={generating} style={{
          padding: "0.8rem 1.6rem", borderRadius: "0.8rem", border: "none", background: "#003934",
          fontSize: "1.4rem", fontWeight: 500, cursor: generating ? "not-allowed" : "pointer", color: "#fff",
          opacity: generating ? 0.7 : 1
        }}>
          {generating ? "Generating..." : "Download PDF"}
        </button>
      </div>

      <div ref={reportRef} style={{ width: "79.4rem", margin: "0 auto", padding: "3.6rem", fontFamily: "Arial, system-ui, sans-serif", color: "#1A2E29", background: "#F5F7F5", boxSizing: "border-box" }}>

      <header style={{ background: "#0D3028", color: "#fff", borderRadius: "1.8rem", padding: "3rem", marginBottom: "2rem", breakInside: "avoid" }}>
        <p style={{ color: "#70E1CD", fontSize: "1.1rem", fontWeight: 800, letterSpacing: ".16em", margin: "0 0 1.5rem" }}>PERCEPT · PERSONALISED REPORT</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", gap: "2rem" }}>
          <div><h1 style={{ fontSize: "3.2rem", lineHeight: 1.06, margin: "0 0 .8rem", letterSpacing: "-.04em" }}>{name ? `${name}'s report` : "Your report"}</h1>
          <p style={{ color: "#D7E7E2", fontSize: "1.15rem", margin: 0 }}>{new Date(session.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · A practical guide to what to keep, improve and try</p></div>
          <div style={{ textAlign: "right" }}><strong style={{ display: "block", fontSize: "5.2rem", lineHeight: .85, color: "#70E1CD" }}>{session.overall_score ?? "—"}</strong><span style={{ color: "#D7E7E2", fontSize: "1rem" }}>PERCEPT SCORE / 100</span></div>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1.25fr .75fr", gap: "1.4rem", marginBottom: "2.2rem", breakInside: "avoid" }}>
        <div style={{ background: "#fff", borderRadius: "1.4rem", padding: "2rem", border: "1px solid #DCE5E1" }}>
          <p style={{ color: "#168D78", fontSize: "1rem", fontWeight: 800, letterSpacing: ".1em", margin: "0 0 .7rem" }}>START HERE</p>
          <h2 style={{ ...H2, marginBottom: ".8rem" }}>Your top priorities</h2>
          {priorities.map((metric, index) => <div key={metric.metricName} style={{ display: "grid", gridTemplateColumns: "2.2rem 1fr auto", gap: ".8rem", alignItems: "start", padding: ".9rem 0", borderTop: index ? "1px solid #E5EBE8" : "none" }}>
            <span style={{ width: "2.1rem", height: "2.1rem", borderRadius: "50%", background: printBand(metric.score).tint, color: printBand(metric.score).colour, display: "grid", placeItems: "center", fontWeight: 800 }}>{index + 1}</span>
            <div><strong style={{ fontSize: "1.15rem", color: "#102F28" }}>{metric.metricName}</strong><p style={{ fontSize: "1rem", lineHeight: 1.45, color: "#536A64", margin: ".25rem 0 0" }}>{concise(metric.recommendation, 145) || "Keep monitoring this area over time."}</p></div>
            <strong style={{ color: printBand(metric.score).colour }}>{metric.score}</strong>
          </div>)}
        </div>
        <div style={{ background: "#E6F3EF", borderRadius: "1.4rem", padding: "2rem" }}>
          <p style={{ color: "#168D78", fontSize: "1rem", fontWeight: 800, letterSpacing: ".1em", margin: "0 0 .7rem" }}>QUICK READ</p>
          <h2 style={{ ...H2, marginBottom: ".8rem" }}>Strongest areas</h2>
          {strengths.map((metric) => <div key={metric.metricName} style={{ display: "flex", justifyContent: "space-between", gap: ".8rem", padding: ".6rem 0", borderBottom: "1px solid #CDE2DB", fontSize: "1rem" }}><span>{metric.metricName}</span><strong>{metric.score}</strong></div>)}
          {session.skin_age !== null && <p style={{ margin: "1.2rem 0 0", fontSize: ".95rem", color: "#536A64" }}>Estimated skin age <strong style={{ color: "#0D3028" }}>{session.skin_age}</strong></p>}
        </div>
      </section>

      {(session.positive_observations ?? []).length > 0 && (hasSkin || hasHair) && (
        <div style={{ ...BLOCK, background: "#fff", border: "1px solid #DCE5E1", borderRadius: "1.4rem", padding: "2rem" }}>
          <h2 style={H2}>What’s already working</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".7rem 1.5rem" }}>
            {(session.positive_observations ?? []).slice(0, 6).map((p, i) => <div key={i} style={{ display: "flex", gap: ".6rem", alignItems: "start", fontSize: "1rem", lineHeight: 1.4 }}><span style={{ color: "#168D78", fontWeight: 900 }}>✓</span><span>{concise(p, 110)}</span></div>)}
          </div>
        </div>
      )}

      {(["skin", "face", "hair"] as MetricCategory[]).map((cat) => {
        if (!categoryAllowed(cat)) return null;
        const rows = metrics.filter((m) => m.category === cat);
        if (rows.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: "2.2rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}><h2 style={{ ...H2, textTransform: "capitalize", margin: 0 }}>{cat === "hair" ? "Hair & scalp" : `${cat} analysis`}</h2><span style={{ color: "#71827D", fontSize: ".95rem" }}>{rows.length} measurements</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {rows.map((m) => (
              <div key={m.metricName} style={{ padding: "1.3rem", background: "#fff", border: "1px solid #DCE5E1", borderRadius: "1.1rem", breakInside: "avoid" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <strong style={{ fontSize: "1.12rem", color: "#102F28" }}>{m.metricName}</strong>
                  <span style={{ fontSize: ".9rem", fontWeight: 700, whiteSpace: "nowrap", padding: ".25rem .55rem", borderRadius: "9999px", color: printBand(m.score).colour, background: printBand(m.score).tint }}>{m.score ?? "-"} · {printBand(m.score).label}</span>
                </div>
                {m.score !== null && <div style={{ height: ".32rem", margin: ".65rem 0", overflow: "hidden", borderRadius: "9999px", background: "#E8E6E0" }}><span style={{ display: "block", width: `${m.score}%`, height: "100%", background: printBand(m.score).colour }} /></div>}
                {m.explanation && <p style={{ fontSize: ".94rem", color: "#536A64", margin: ".35rem 0 0", lineHeight: 1.45 }}>{concise(m.explanation)}</p>}
                {m.recommendation && <div style={{ marginTop: ".7rem", padding: ".7rem .8rem", borderRadius: ".7rem", background: "#F0F7F4", fontSize: ".94rem", color: "#123F34", lineHeight: 1.42 }}><strong>Do this: </strong>{concise(m.recommendation, 150)}</div>}
              </div>
            ))}
            </div>
          </div>
        );
      })}

      {recs && (hasSkin || hasHair) && (
        <div style={{ marginBottom: "2.2rem" }}>
          <h2 style={H2}>Your simple routine</h2>
          <p style={{ color: "#536A64", fontSize: "1rem", margin: "-.6rem 0 1.2rem" }}>A practical checklist—save this page and start with consistency, not complexity.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {ROUTINE_META.filter((r) => (r.gate === "skin" ? hasSkin : hasHair)).map(({ key, label }) => {
            const steps = recs[key];
            if (!steps?.length) return null;
            return (
              <div key={key} style={{ padding: "1.4rem", background: "#fff", border: "1px solid #DCE5E1", borderRadius: "1.1rem", breakInside: "avoid" }}>
                <strong style={{ fontSize: "1.15rem", color: "#0D3028" }}>{label}</strong>
                <ol style={{ margin: ".7rem 0 0", paddingLeft: "1.4rem" }}>
                  {steps.map((s, i) => <li key={i} style={{ fontSize: ".95rem", marginBottom: ".45rem", lineHeight: 1.42, color: "#445C56" }}>{concise(s, 125)}</li>)}
                </ol>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {hasColour && colour && (
        <div style={{ marginBottom: "2.6rem", pageBreakBefore: "always" }}>
          <h2 style={H2}>Colour analysis</h2>
          <p style={{ fontSize: "1.3rem", margin: "0 0 0.6rem" }}><strong>{colour.sub_season}</strong> · {colour.undertone} undertone · {colour.contrast_level} contrast · best metal {colour.metal_recommendation.replace("_", " ")}</p>
          <p style={{ fontSize: "1.1rem", color: "#444", lineHeight: 1.55, margin: "0 0 1.2rem" }}>{colour.description}</p>

          {images.colour && (
            <div style={{ marginBottom: "1.4rem" }}>
              <GridImage src={images.colour} alt="You wearing your recommended colours" labels={COLOUR_LABELS} />
            </div>
          )}

          {([["Wear these", colour.best_colours], ["Avoid these", colour.worst_colours], ["Neutrals", colour.neutrals]] as const).map(([title, list]) =>
            (list ?? []).length === 0 ? null : (
              <div key={title} style={{ marginBottom: "1rem", pageBreakInside: "avoid" }}>
                <strong style={{ fontSize: "1.15rem", color: "#003934" }}>{title}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.4rem" }}>
                  {list.map((c, i) => (
                    <span key={c.hex + i} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", border: "1px solid #ddd", borderRadius: "9999px", padding: "0.2rem 0.6rem 0.2rem 0.25rem", fontSize: "1rem" }}>
                      <span style={{ width: "1rem", height: "1rem", borderRadius: "50%", background: c.hex, display: "inline-block" }} />
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {hasHair && images.hair && (
        <div style={BLOCK}>
          <h2 style={H2}>Hairstyle suggestions</h2>
          <GridImage src={images.hair} alt="Hairstyle previews on your photo" labels={HAIR_LABELS} />
        </div>
      )}

      {hasHair && (
        <div style={BLOCK}>
          <h2 style={H2}>Beard suggestions</h2>
          {images.beard ? <GridImage src={images.beard} alt="Beard previews on your photo" labels={BEARD_LABELS} /> : <p style={{ padding: "1rem 1.2rem", border: "1px solid #ddd", borderRadius: ".6rem", color: "#555", fontSize: "1.1rem" }}>Beard previews have not been generated yet. Open the interactive report and select Generate beard previews to add them here.</p>}
        </div>
      )}

      {hasFrame && images.frame && (
        <div style={BLOCK}>
          <h2 style={H2}>Frame suggestions</h2>
          <GridImage src={images.frame} alt="Frame previews on your photo" labels={FRAME_LABELS} />
        </div>
      )}

      {(session.limitations ?? []).length > 0 && (
        <div style={{ ...BLOCK, padding: "1.5rem", background: "#FFF8E8", borderRadius: "1rem" }}>
          <h2 style={H2}>Good to know</h2>
          <ul style={{ margin: 0, paddingLeft: "1.6rem" }}>
            {(session.limitations ?? []).map((l, i) => <li key={i} style={{ fontSize: "1.05rem", color: "#555", marginBottom: "0.3rem", lineHeight: 1.5 }}>{l}</li>)}
          </ul>
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ ...BLOCK, paddingTop: "1rem" }}>
          <h2 style={H2}>Photos analysed</h2>
          <p style={{ color: "#71827D", fontSize: ".95rem", margin: "-.6rem 0 1rem" }}>Included for reference. Results are based on visible features in these images.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: ".55rem" }}>
            {photos.map((p) => (
              <div key={p.type}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={PHOTO_LABELS[p.type] ?? p.type} style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", borderRadius: ".6rem", display: "block" }} />
                <p style={{ ...CAPTION, textAlign: "center", fontSize: ".8rem" }}>{PHOTO_LABELS[p.type] ?? p.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: "1rem", color: "#888", marginTop: "2.4rem", lineHeight: 1.5 }}>
        Generated previews are illustrative. Percept offers cosmetic and wellness insights, not a medical diagnosis. Consult a qualified dermatologist for any concerning visible change.
      </p>

      </div>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </>
  );
}
