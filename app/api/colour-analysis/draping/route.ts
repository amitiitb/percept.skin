import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { generateColourDraping } from "@/lib/v2/gemini";
import { hasPurchasedModule } from "@/lib/v2/requirePurchase";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import { logV2 } from "@/lib/v2/log";
import type { ColourAnalysis, ColourSwatch } from "@/lib/v2/types";

// How many of each list get a real generated photo. Each one is a separate
// billed Gemini call, so this is the cost/value dial for the whole feature:
// at 4 + 2 it is 6 images per analysis. They run in parallel (see below),
// which is what keeps the wait ~30s rather than ~3 minutes.
const BEST_COUNT = 4;
const AVOID_COUNT = 2;

function scopedClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
}

export interface DrapingImage {
  label: string;
  hex: string;
  kind: "best" | "avoid";
  storagePath: string;
  url?: string;
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, photoDataUrl } = await req.json() as { sessionId?: string; photoDataUrl?: string };
  if (!sessionId || !photoDataUrl) {
    return NextResponse.json({ error: "sessionId and photoDataUrl are required" }, { status: 400 });
  }

  const token = req.headers.get("authorization")!.slice(7);
  const supabase = scopedClient(token);

  if (!(await hasPurchasedModule(supabase, auth.userId, sessionId, "colour"))) {
    return NextResponse.json({ error: "Purchase the Color Analysis module to generate your draping previews" }, { status: 403 });
  }

  // Each request fans out to BEST_COUNT + AVOID_COUNT billed image generations,
  // so this is the most expensive route in the app per call. Capped tighter
  // than the single-image routes for that reason.
  if (!(await checkRateLimit(supabase, auth.userId, "colour_draping", 6, 600))) {
    return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });
  }

  // The palette comes from the existing Claude analysis rather than being
  // re-derived here, so the photos always match the season the report shows.
  const { data: row } = await supabase
    .from("colour_analysis_v2").select("data").eq("session_id", sessionId).eq("user_id", auth.userId).maybeSingle();
  const analysis = row?.data as ColourAnalysis | undefined;
  if (!analysis) {
    return NextResponse.json({ error: "Run your colour analysis first, then generate the previews" }, { status: 409 });
  }

  const picks: Array<{ sw: ColourSwatch; kind: "best" | "avoid" }> = [
    ...(analysis.best_colours ?? []).slice(0, BEST_COUNT).map((sw) => ({ sw, kind: "best" as const })),
    ...(analysis.worst_colours ?? []).slice(0, AVOID_COUNT).map((sw) => ({ sw, kind: "avoid" as const })),
  ];
  if (picks.length === 0) {
    return NextResponse.json({ error: "No colours available to preview" }, { status: 409 });
  }

  try {
    // Parallel, not sequential: 6 sequential generations would be a ~3 minute
    // wait. allSettled so one refusal or timeout cannot lose the whole batch.
    const results = await Promise.allSettled(
      picks.map(async ({ sw, kind }) => {
        const { mimeType, base64 } = await generateColourDraping(photoDataUrl, sw.name, sw.hex);
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const slug = sw.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const path = `${auth.userId}/${sessionId}/drape-${kind}-${slug}.${ext}`;
        const { error: upErr } = await supabase.storage.from("photos_v2")
          .upload(path, Buffer.from(base64, "base64"), { contentType: mimeType, upsert: true });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(path, 60 * 60 * 24 * 7);
        return { label: sw.name, hex: sw.hex, kind, storagePath: path, url: signed?.signedUrl } as DrapingImage;
      })
    );

    const images = results.filter((r): r is PromiseFulfilledResult<DrapingImage> => r.status === "fulfilled").map((r) => r.value);
    const failed = results.length - images.length;
    if (images.length === 0) {
      const reason = results[0]?.status === "rejected" ? String((results[0] as PromiseRejectedResult).reason).slice(0, 200) : "unknown";
      logV2.error("v2_colour_draping_all_failed", { user_id: auth.userId, session_id: sessionId, reason });
      return NextResponse.json({ error: "Could not generate your colour previews. Please try again." }, { status: 502 });
    }

    // Persist alongside the analysis so a revisit does not pay to regenerate.
    // Paths only, never signed URLs, since those expire.
    await supabase.from("colour_analysis_v2")
      .update({ data: { ...analysis, drapings: images.map(({ url: _url, ...rest }) => rest) } })
      .eq("session_id", sessionId).eq("user_id", auth.userId);

    logV2.info("v2_colour_draping_generated", { user_id: auth.userId, session_id: sessionId, generated: images.length, failed });
    return NextResponse.json({ images, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_colour_draping_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Could not generate your colour previews. Please try again." }, { status: 500 });
  }
}
