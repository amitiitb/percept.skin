import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { getAnalysisProvider } from "@/lib/v2/aiProvider";
import { logV2 } from "@/lib/v2/log";
import type { AnalysisMetric, SkinConcern, SkinType } from "@/lib/v2/types";

// Scoped to the caller's JWT so RLS applies as that user (not a service-role bypass) —
// same isolation guarantee the client-side queries rely on.
function scopedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySupabaseUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await req.json() as { sessionId?: string };
    if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

    const token = req.headers.get("authorization")!.slice(7);
    const supabase = scopedClient(token);

    const { data: session, error: sessErr } = await supabase
      .from("analysis_sessions_v2").select("id, user_id").eq("id", sessionId).single();
    if (sessErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const { data: photos } = await supabase
      .from("analysis_photos_v2").select("photo_type, storage_path").eq("session_id", sessionId);

    const photoUrls: Record<string, string> = {};
    for (const p of photos ?? []) {
      const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(p.storage_path, 60 * 60 * 24 * 7);
      if (signed) photoUrls[p.photo_type] = signed.signedUrl;
    }

    const { data: profile } = await supabase
      .from("user_profiles_v2").select("skin_type, skin_concerns, age_range").eq("user_id", auth.userId).maybeSingle();

    const provider = getAnalysisProvider();
    const result = await provider.analyse({
      photoUrls,
      profile: {
        skinType: (profile?.skin_type as SkinType) ?? null,
        skinConcerns: (profile?.skin_concerns as SkinConcern[]) ?? [],
        ageRange: profile?.age_range ?? "",
      },
    });

    const allMetrics: AnalysisMetric[] = [...result.skinMetrics, ...result.faceMetrics, ...result.hairMetrics];
    const rows = allMetrics.map((m) => ({
      session_id: sessionId, user_id: auth.userId, category: m.category, metric_name: m.metricName,
      score: m.score, label: m.label, confidence: m.confidence, explanation: m.explanation,
      recommendation: m.recommendation, is_premium: m.isPremium,
    }));
    const { error: metricsErr } = await supabase.from("analysis_metrics_v2").upsert(rows, { onConflict: "session_id,category,metric_name" });
    if (metricsErr) throw metricsErr;

    const { error: updateErr } = await supabase.from("analysis_sessions_v2").update({
      status: "complete", overall_score: result.overallScore, skin_age: result.skinAgeEstimate,
      completed_at: new Date().toISOString(),
    }).eq("id", sessionId);
    if (updateErr) throw updateErr;

    logV2.info("v2_analysis_completed", { session_id: sessionId, overall_score: result.overallScore });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_analysis_failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
