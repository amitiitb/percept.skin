"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AnalysisMetric, MetricCategory } from "@/lib/v2/types";
import type { ModuleId } from "@/lib/v2/reportModules";

export default function V2ReportPrintPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [session, setSession] = useState<{ overall_score: number | null; skin_age: number | null; created_at: string } | null>(null);
  const [metrics, setMetrics] = useState<AnalysisMetric[]>([]);
  const [purchased, setPurchased] = useState<Set<ModuleId>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: profile }, { data: sess }, { data: metricRows }, { data: purchase }] = await Promise.all([
        supabase.from("user_profiles_v2").select("name").eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_sessions_v2").select("overall_score, skin_age, created_at").eq("id", sessionId).eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_metrics_v2").select("category, metric_name, score, label, explanation, recommendation, is_premium, confidence").eq("session_id", sessionId).eq("user_id", user.id),
        supabase.from("report_purchases_v2").select("modules").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
      ]);
      setName(profile?.name ?? "");
      setSession(sess);
      setMetrics((metricRows ?? []).map((r) => ({
        category: r.category as MetricCategory, metricName: r.metric_name, score: r.score,
        label: r.label as AnalysisMetric["label"], confidence: r.confidence, explanation: r.explanation,
        recommendation: r.recommendation, isPremium: r.is_premium,
      })));
      setPurchased(new Set((purchase?.modules as ModuleId[]) ?? []));
      setLoading(false);
      setTimeout(() => window.print(), 400);
    });
  }, [sessionId]);

  // "skin" module covers both skin+face categories; "hairstyle" module covers hair — same merge as the report page.
  const categoryAllowed = (cat: MetricCategory) =>
    (cat === "skin" || cat === "face") ? purchased.has("skin") : purchased.has("hairstyle");

  if (loading || !session) return <p style={{ padding: "4rem", fontFamily: "sans-serif" }}>Loading report…</p>;

  return (
    <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "4rem 2rem", fontFamily: "system-ui, sans-serif", color: "#1a2320" }}>
      <h1 style={{ fontSize: "2.4rem", marginBottom: "0.4rem" }}>Glowmetry Report</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        {name || "Glowmetry user"} · {new Date(session.created_at).toLocaleDateString()}
      </p>
      <div style={{ marginBottom: "2.4rem" }}>
        <strong style={{ fontSize: "4rem" }}>{session.overall_score}</strong>
        <span style={{ fontSize: "1.4rem" }}> / 100 Glow Score</span>
        {session.skin_age !== null && <p>Estimated skin age: {session.skin_age}</p>}
      </div>
      {(["skin", "face", "hair"] as MetricCategory[]).map((cat) => {
        if (!categoryAllowed(cat)) return null;
        const rows = metrics.filter((m) => m.category === cat);
        if (rows.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: "2rem", pageBreakInside: "avoid" }}>
            <h2 style={{ fontSize: "1.6rem", textTransform: "capitalize", borderBottom: "1px solid #ddd", paddingBottom: "0.4rem" }}>{cat}</h2>
            {rows.map((m) => (
              <div key={m.metricName} style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid #eee" }}>
                <span>{m.metricName}</span>
                <span>{m.score} · {m.label}</span>
              </div>
            ))}
          </div>
        );
      })}
      <p style={{ fontSize: "1.1rem", color: "#888", marginTop: "3rem" }}>
        Glowmetry offers cosmetic and wellness insights, not a medical diagnosis. Consult a qualified dermatologist for any concerning visible change.
      </p>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
