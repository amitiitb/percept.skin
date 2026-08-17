import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { generateFrameGrid, FRAME_OCCASIONS } from "@/lib/v2/gemini";
import { hasPurchasedModule } from "@/lib/v2/requirePurchase";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import { logV2 } from "@/lib/v2/log";
import { replaceImage } from "@/lib/v2/storageUpload";
import { MAX_GENERATIONS, gridGenerationsUsed, budgetExhaustedMessage } from "@/lib/v2/generationBudget";
import { signedFrontPhotoForSession } from "@/lib/v2/sessionPhoto";

// One composite grid of five frame styles, the overview shot. The existing
// per-frame route (/api/frame-tryon/generate) stays as the interactive path
// for trying a single style at full size, so this does not replace it.
// Panel 3's cat-eye is a suggestion, not a hard requirement — generateFrameGrid's
// own prompt overrides it with a rounded panto/aviator shape for masculine-
// presenting subjects, since cat-eye is a conventionally feminine silhouette
// and previously rendered on every subject regardless of presentation.
const FRAMES = [
  "thin gunmetal rectangular eyeglasses",
  "black and gold Clubmaster browline eyeglasses",
  "warm tortoiseshell cat-eye eyeglasses",
  "thin gold-metal hexagonal eyeglasses",
  "minimal champagne-gold rimless eyeglasses",
  "matte black Wayfarer eyeglasses with a trapezoidal silhouette",
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

  if (!(await hasPurchasedModule(supabase, auth.userId, sessionId, "frame"))) {
    return NextResponse.json({ error: "Purchase the Frame Recommendations module to generate frame previews" }, { status: 403 });
  }
  if (!(await checkRateLimit(supabase, auth.userId, "frame_grid", 8, 600))) {
    return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });
  }

  const used = await gridGenerationsUsed(supabase, "frame_generations_v2", "frame_name", "Frame grid", auth.userId, sessionId);
  if (used >= MAX_GENERATIONS) {
    return NextResponse.json({ error: budgetExhaustedMessage("frame"), remaining: 0 }, { status: 429 });
  }

  try {
    const sourcePhoto = await signedFrontPhotoForSession(supabase, auth.userId, sessionId);
    const { mimeType, base64 } = await generateFrameGrid(sourcePhoto, FRAMES);
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `${auth.userId}/${sessionId}/frame-grid.${ext}`;

    const { error: upErr } = await replaceImage(supabase, path, Buffer.from(base64, "base64"), mimeType);
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(path, 60 * 60 * 24 * 7);

    const { error: dbErr } = await supabase.from("frame_generations_v2")
      .insert({ session_id: sessionId, user_id: auth.userId, frame_name: "Frame grid", storage_path: path, status: "complete" });
    if (dbErr) logV2.warn("v2_frame_grid_row_failed", { user_id: auth.userId, session_id: sessionId, message: dbErr.message });

    logV2.info("v2_frame_grid_generated", { user_id: auth.userId, session_id: sessionId });
    return NextResponse.json({ storagePath: path, occasions: FRAME_OCCASIONS, url: signed?.signedUrl, remaining: MAX_GENERATIONS - used - 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_frame_grid_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Could not generate your frame previews. Please try again." }, { status: 500 });
  }
}
