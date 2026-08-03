"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

const COLOUR_LABELS = ["Office", "Formal suit", "Wedding / festive", "Weekend casual", "Evening party", "Smart casual"];
const HAIR_LABELS = ["Office", "Wedding / formal", "Everyday casual", "Evening party", "Short & low-maintenance", "Textured everyday"];
const FRAME_LABELS = ["Office", "Evening / party", "Formal & wedding", "Everyday casual", "Minimal rimless", "Sporty everyday"];

const CAPTION: React.CSSProperties = { fontSize: "1.05rem", color: "#666", margin: "0.5rem 0 0" };

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
  const [images, setImages] = useState<{ colour?: string; hair?: string; frame?: string }>({});

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: profile }, { data: sess }, { data: metricRows }, { data: purchase }, { data: photoRows }, { data: colourRow }, { data: hairRows }, { data: frameRows }] = await Promise.all([
        supabase.from("user_profiles_v2").select("name").eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_sessions_v2").select("overall_score, skin_age, created_at, positive_observations, recommendations, limitations").eq("id", sessionId).eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_metrics_v2").select("category, metric_name, score, label, explanation, recommendation, is_premium, confidence").eq("session_id", sessionId).eq("user_id", user.id),
        supabase.from("report_purchases_v2").select("modules").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_photos_v2").select("photo_type, storage_path").eq("session_id", sessionId).eq("user_id", user.id),
        supabase.from("colour_analysis_v2").select("data").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
        supabase.from("hairstyle_generations_v2").select("storage_path").eq("session_id", sessionId).eq("user_id", user.id).eq("style_name", "Style grid").order("created_at", { ascending: false }).limit(1),
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

      // Sign everything in one pass so the render has final URLs and the images
      // start loading immediately.
      async function sign(path?: string | null) {
        if (!path) return undefined;
        const { data } = await supabase.storage.from("photos_v2").createSignedUrl(path, 60 * 60);
        return data?.signedUrl;
      }
      const signedPhotos = await Promise.all((photoRows ?? []).map(async (p) => ({
        type: p.photo_type as string, url: (await sign(p.storage_path as string)) ?? "",
      })));
      setPhotos(signedPhotos.filter((p) => p.url).sort((a, b) => PHOTO_ORDER.indexOf(a.type) - PHOTO_ORDER.indexOf(b.type)));

      const [colourUrl, hairUrl, frameUrl] = await Promise.all([
        sign(analysis?.drapings?.storagePath),
        sign(hairRows?.[0]?.storage_path as string | undefined),
        sign(frameRows?.[0]?.storage_path as string | undefined),
      ]);
      setImages({ colour: colourUrl, hair: hairUrl, frame: frameUrl });
      setLoading(false);
    });
  }, [sessionId]);

  // Wait for every image to finish loading before opening the print dialog,
  // with a ceiling so one slow or broken image cannot block the download.
  useEffect(() => {
    if (loading) return;
    let done = false;
    const go = () => { if (!done) { done = true; window.print(); } };
    const imgs = Array.from(document.images);
    Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise<void>((res) => {
      img.addEventListener("load", () => res(), { once: true });
      img.addEventListener("error", () => res(), { once: true });
    }))).then(() => setTimeout(go, 300));
    const ceiling = setTimeout(go, 12000);
    return () => clearTimeout(ceiling);
  }, [loading]);

  // "skin" covers skin+face categories; "hairstyle" covers hair, same merge as the report page.
  const categoryAllowed = (cat: MetricCategory) =>
    (cat === "skin" || cat === "face") ? purchased.has("skin") : purchased.has("hairstyle");

  if (loading || !session) return <p style={{ padding: "4rem", fontFamily: "sans-serif" }}>Preparing your report…</p>;

  const hasSkin = purchased.has("skin");
  const hasHair = purchased.has("hairstyle");
  const hasColour = purchased.has("colour");
  const hasFrame = purchased.has("frame");
  const recs = session.recommendations;

  const H2: React.CSSProperties = { fontSize: "1.9rem", margin: "0 0 1rem", paddingBottom: "0.5rem", borderBottom: "2px solid #003934", color: "#003934" };
  const BLOCK: React.CSSProperties = { marginBottom: "2.6rem", pageBreakInside: "avoid" };

  return (
    <div style={{ maxWidth: "74rem", margin: "0 auto", padding: "4rem 2rem", fontFamily: "system-ui, sans-serif", color: "#1a2320" }}>

      <header style={{ marginBottom: "2.4rem" }}>
        <h1 style={{ fontSize: "2.4rem", margin: "0 0 0.3rem", color: "#003934" }}>Percept Report</h1>
        <p style={{ color: "#666", margin: 0 }}>{name || "Percept user"} · {new Date(session.created_at).toLocaleDateString()}</p>
      </header>

      <div style={{ display: "flex", alignItems: "baseline", gap: "1.4rem", marginBottom: "2.6rem" }}>
        <strong style={{ fontSize: "4rem", color: "#003934", lineHeight: 1 }}>{session.overall_score}</strong>
        <span style={{ fontSize: "1.3rem", color: "#666" }}>/ 100 Percept Score</span>
        {session.skin_age !== null && <span style={{ fontSize: "1.3rem", color: "#666" }}>· Estimated skin age {session.skin_age}</span>}
      </div>

      {photos.length > 0 && (
        <div style={BLOCK}>
          <h2 style={H2}>Your photos</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.5rem" }}>
            {photos.map((p) => (
              <div key={p.type}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={PHOTO_LABELS[p.type] ?? p.type} style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", borderRadius: "0.4rem", display: "block" }} />
                <p style={{ ...CAPTION, textAlign: "center" }}>{PHOTO_LABELS[p.type] ?? p.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(session.positive_observations ?? []).length > 0 && (hasSkin || hasHair) && (
        <div style={BLOCK}>
          <h2 style={H2}>What is working well</h2>
          <ul style={{ margin: 0, paddingLeft: "1.6rem" }}>
            {(session.positive_observations ?? []).map((p, i) => <li key={i} style={{ marginBottom: "0.4rem", lineHeight: 1.55 }}>{p}</li>)}
          </ul>
        </div>
      )}

      {(["skin", "face", "hair"] as MetricCategory[]).map((cat) => {
        if (!categoryAllowed(cat)) return null;
        const rows = metrics.filter((m) => m.category === cat);
        if (rows.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: "2.6rem" }}>
            <h2 style={{ ...H2, textTransform: "capitalize" }}>{cat === "hair" ? "Hair & scalp" : cat}</h2>
            {rows.map((m) => (
              <div key={m.metricName} style={{ padding: "0.7rem 0", borderBottom: "1px solid #eee", pageBreakInside: "avoid" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <strong style={{ fontSize: "1.2rem" }}>{m.metricName}</strong>
                  <span style={{ fontSize: "1.2rem", whiteSpace: "nowrap" }}>{m.score ?? "no read"}{m.label ? ` · ${m.label}` : ""}</span>
                </div>
                {m.explanation && <p style={{ fontSize: "1.1rem", color: "#444", margin: "0.35rem 0 0", lineHeight: 1.5 }}>{m.explanation}</p>}
                {m.recommendation && <p style={{ fontSize: "1.1rem", color: "#003934", margin: "0.3rem 0 0", lineHeight: 1.5 }}><strong>Next step:</strong> {m.recommendation}</p>}
              </div>
            ))}
          </div>
        );
      })}

      {recs && (hasSkin || hasHair) && (
        <div style={{ marginBottom: "2.6rem" }}>
          <h2 style={H2}>Your routine</h2>
          {ROUTINE_META.filter((r) => (r.gate === "skin" ? hasSkin : hasHair)).map(({ key, label }) => {
            const steps = recs[key];
            if (!steps?.length) return null;
            return (
              <div key={key} style={{ marginBottom: "1.2rem", pageBreakInside: "avoid" }}>
                <strong style={{ fontSize: "1.25rem", color: "#003934" }}>{label}</strong>
                <ol style={{ margin: "0.4rem 0 0", paddingLeft: "1.6rem" }}>
                  {steps.map((s, i) => <li key={i} style={{ fontSize: "1.1rem", marginBottom: "0.25rem", lineHeight: 1.5 }}>{s}</li>)}
                </ol>
              </div>
            );
          })}
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

      {hasFrame && images.frame && (
        <div style={BLOCK}>
          <h2 style={H2}>Frame suggestions</h2>
          <GridImage src={images.frame} alt="Frame previews on your photo" labels={FRAME_LABELS} />
        </div>
      )}

      {(session.limitations ?? []).length > 0 && (
        <div style={BLOCK}>
          <h2 style={H2}>Good to know</h2>
          <ul style={{ margin: 0, paddingLeft: "1.6rem" }}>
            {(session.limitations ?? []).map((l, i) => <li key={i} style={{ fontSize: "1.05rem", color: "#555", marginBottom: "0.3rem", lineHeight: 1.5 }}>{l}</li>)}
          </ul>
        </div>
      )}

      <p style={{ fontSize: "1rem", color: "#888", marginTop: "2.4rem", lineHeight: 1.5 }}>
        Generated previews are illustrative. Percept offers cosmetic and wellness insights, not a medical diagnosis. Consult a qualified dermatologist for any concerning visible change.
      </p>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 14mm; }
        }
      `}</style>
    </div>
  );
}
