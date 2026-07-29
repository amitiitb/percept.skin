import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { generateColourGrid, COLOUR_OCCASIONS } from "@/lib/v2/gemini";
import { hasPurchasedModule } from "@/lib/v2/requirePurchase";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import { logV2 } from "@/lib/v2/log";
import type { ColourAnalysis, ColourSwatch } from "@/lib/v2/types";

// How many palette colours are fed into the single composite grid. One
// billed generation total, not one per colour.
const BEST_COUNT = 6;

function scopedClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
}

export interface DrapingResult {
  storagePath: string;
  colours: Array<{ label: string; hex: string }>;
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

  if (!(await checkRateLimit(supabase, auth.userId, "colour_draping", 8, 600))) {
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

  const picks: ColourSwatch[] = (analysis.best_colours ?? []).slice(0, BEST_COUNT);
  if (picks.length === 0) {
    return NextResponse.json({ error: "No colours available to preview" }, { status: 409 });
  }

  try {
    const { mimeType, base64 } = await generateColourGrid(photoDataUrl, picks.map((s) => s.name));
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `${auth.userId}/${sessionId}/colour-grid.${ext}`;

    const { error: upErr } = await supabase.storage.from("photos_v2")
      .upload(path, Buffer.from(base64, "base64"), { contentType: mimeType, upsert: true });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(path, 60 * 60 * 24 * 7);

    const colours = picks.map((s) => ({ label: s.name, hex: s.hex }));

    // Persist alongside the analysis so revisiting the report does not pay to
    // regenerate. Path only, never the signed URL, since those expire.
    await supabase.from("colour_analysis_v2")
      .update({ data: { ...analysis, drapings: { storagePath: path, colours } } })
      .eq("session_id", sessionId).eq("user_id", auth.userId);

    logV2.info("v2_colour_grid_generated", { user_id: auth.userId, session_id: sessionId, colours: colours.length });
    return NextResponse.json({ storagePath: path, colours, occasions: COLOUR_OCCASIONS, url: signed?.signedUrl } as DrapingResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_colour_draping_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Could not generate your colour previews. Please try again." }, { status: 500 });
  }
}
