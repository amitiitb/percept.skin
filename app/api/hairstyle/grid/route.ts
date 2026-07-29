import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { generateHairstyleGrid } from "@/lib/v2/gemini";
import { hasPurchasedModule } from "@/lib/v2/requirePurchase";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import { logV2 } from "@/lib/v2/log";

// One composite grid of several hairstyles, rather than one billed generation
// per style tapped. Same reasoning as the colour grid: cheaper, faster, and
// every panel is lit and framed identically by construction.
const STYLES = [
  "long layered waves",
  "chin-length textured bob",
  "soft curtain bangs",
  "blunt shoulder-length lob",
  "very short pixie cut",
];

function scopedClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
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

  if (!(await hasPurchasedModule(supabase, auth.userId, sessionId, "hairstyle"))) {
    return NextResponse.json({ error: "Purchase the Hairstyle Recommendations module to generate style previews" }, { status: 403 });
  }
  if (!(await checkRateLimit(supabase, auth.userId, "hairstyle_grid", 8, 600))) {
    return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });
  }

  try {
    const { mimeType, base64 } = await generateHairstyleGrid(photoDataUrl, STYLES);
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `${auth.userId}/${sessionId}/hairstyle-grid.${ext}`;

    const { error: upErr } = await supabase.storage.from("photos_v2")
      .upload(path, Buffer.from(base64, "base64"), { contentType: mimeType, upsert: true });
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(path, 60 * 60 * 24 * 7);

    // styleName doubles as the idempotency key for the grid row, so a repeat
    // run replaces the previous grid rather than stacking duplicates.
    const { error: dbErr } = await supabase.from("hairstyle_generations_v2")
      .insert({ session_id: sessionId, user_id: auth.userId, style_name: "Style grid", storage_path: path, status: "complete" });
    if (dbErr) logV2.warn("v2_hairstyle_grid_row_failed", { user_id: auth.userId, session_id: sessionId, message: dbErr.message });

    logV2.info("v2_hairstyle_grid_generated", { user_id: auth.userId, session_id: sessionId });
    return NextResponse.json({ storagePath: path, styles: STYLES, url: signed?.signedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_hairstyle_grid_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Could not generate your hairstyle previews. Please try again." }, { status: 500 });
  }
}
