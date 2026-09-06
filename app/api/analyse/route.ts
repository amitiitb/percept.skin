import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { getAnalysisProvider, ClaudeTimeoutError, ClaudeRateLimitError, SchemaParseError, SchemaValidationError } from "@/lib/v2/aiProvider";
import { logV2 } from "@/lib/v2/log";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import type { AnalysisMetric, SkinConcern, SkinType } from "@/lib/v2/types";

const STALE_STAGE_MS = 5 * 60 * 1000;

function messageForError(err: unknown): string {
  if (err instanceof ClaudeTimeoutError) return "Taking longer than usual, try again";
  if (err instanceof ClaudeRateLimitError) return "High demand right now, try again in a minute";
  if (err instanceof SchemaParseError || err instanceof SchemaValidationError) return "Something went wrong reading your results, try again";
  return "Something went wrong, try again";
}

async function markFailed(supabase: SupabaseClient, sessionId: string, message: string) {
  // `status` (what History reads to decide Ready/Processing) and `stage`
  // (finer-grained internal progress) are separate columns — this used to
  // update `stage` only, so a session whose analysis genuinely failed kept
  // reporting `status: "analyzing"`/"capturing" forever. History has no way
  // to tell "still working" from "died and will never finish," the card
  // stays stuck on "Processing" indefinitely, and there's nothing to retry
  // or delete because the UI still believes it might complete on its own.
  await supabase.from("analysis_sessions_v2").update({
    status: "failed", stage: "failed", fail_reason: message, stage_updated_at: new Date().toISOString(),
  }).eq("id", sessionId);
}

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
  // Hoisted so the catch block can mark the session failed with a real
  // stage/fail_reason write — a bare req.json() can only be consumed once,
  // so re-reading the body from the catch block isn't an option.
  let sessionId: string | undefined;
  let token: string | undefined;
  try {
    const auth = await verifySupabaseUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    ({ sessionId } = await req.json() as { sessionId?: string });
    if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

    token = req.headers.get("authorization")!.slice(7);
    const supabase = scopedClient(token);

    // Every call here triggers a real, paid Claude/Gemini request — cap per
    // user so a scripted loop can't run up API cost unbounded.
    const withinLimit = await checkRateLimit(supabase, auth.userId, "analyse", 15, 600);
    if (!withinLimit) {
      return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });
    }

    const { data: session, error: sessErr } = await supabase
      .from("analysis_sessions_v2").select("id, user_id").eq("id", sessionId).single();
    if (sessErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Idempotency guard — a single conditional UPDATE, not read-then-write, so
    // two concurrent requests for the same session (double reload, two tabs)
    // can't both kick off a paid Claude call. Claims from: never started,
    // previously failed, or stuck (stage_updated_at stale — covers a process
    // killed mid-request before it could mark itself failed). Zero rows
    // returned means another request already owns this session; the client
    // just polls `stage` instead of treating this as an error.
    const staleBefore = new Date(Date.now() - STALE_STAGE_MS).toISOString();
    const { data: claimed, error: claimErr } = await supabase.from("analysis_sessions_v2")
      .update({ stage: "fetching_photos", fail_reason: null, stage_updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .or(`stage.is.null,stage.eq.failed,stage_updated_at.lt.${staleBefore}`)
      .select("id");
    // A real Postgrest error here (e.g. the stage/fail_reason/stage_updated_at
    // columns don't exist yet because the migration hasn't run) must fail
    // loud, not be mistaken for "another request already claimed this session" —
    // that misread would silently no-op every analysis until the migration ships.
    if (claimErr) throw claimErr;
    if (!claimed || claimed.length === 0) {
      logV2.info("v2_analysis_already_running", { session_id: sessionId });
      return NextResponse.json({ alreadyRunning: true });
    }

    const { data: photos } = await supabase
      .from("analysis_photos_v2").select("photo_type, storage_path").eq("session_id", sessionId);

    const photoUrls: Record<string, string> = {};
    for (const p of photos ?? []) {
      const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(p.storage_path, 60 * 60 * 24 * 7);
      if (signed) photoUrls[p.photo_type] = signed.signedUrl;
    }

    const { data: profile } = await supabase
      .from("user_profiles_v2").select("skin_type, skin_concerns, age_range").eq("user_id", auth.userId).maybeSingle();

    await supabase.from("analysis_sessions_v2").update({ stage: "analyzing", stage_updated_at: new Date().toISOString() }).eq("id", sessionId);

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
      completed_at: new Date().toISOString(), stage: "scoring", stage_updated_at: new Date().toISOString(),
    }).eq("id", sessionId);
    if (updateErr) throw updateErr;

    // Separate, best-effort update for the richer report content (real
    // skincare/haircare recommendations, positive observations, priority
    // concerns, limitations) — kept apart from the update above so a
    // pre-migration environment (columns not added yet) still completes the
    // core analysis instead of failing the whole request over optional content.
    const { error: contentErr } = await supabase.from("analysis_sessions_v2").update({
      positive_observations: result.positiveObservations,
      priority_concerns: result.priorityConcerns,
      recommendations: result.recommendations,
      limitations: result.limitations,
      stage: "complete", stage_updated_at: new Date().toISOString(),
    }).eq("id", sessionId);
    if (contentErr) {
      logV2.warn("v2_analysis_content_save_failed", { session_id: sessionId, message: contentErr.message });
      // Content columns may not exist pre-migration — still mark the stage
      // complete on its own so the client's progress UI doesn't get stuck
      // behind an update that failed for an unrelated (optional-column) reason.
      await supabase.from("analysis_sessions_v2").update({ stage: "complete", stage_updated_at: new Date().toISOString() }).eq("id", sessionId);
    }

    logV2.info("v2_analysis_completed", { session_id: sessionId, overall_score: result.overallScore });
    return NextResponse.json({ result });
  } catch (err) {
    // Supabase/Postgrest errors are plain objects, not Error instances —
    // String(err) on those just prints "[object Object]", which is exactly
    // useless in production logs for the errors this route is most likely
    // to hit (missing column, RLS denial, constraint violation).
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    logV2.error("v2_analysis_failed", { message });
    if (token && sessionId) {
      try {
        await markFailed(scopedClient(token), sessionId, messageForError(err));
      } catch {
        // best-effort — the primary error response below is what the client sees regardless
      }
    }
    return NextResponse.json({ error: messageForError(err) }, { status: 500 });
  }
}
