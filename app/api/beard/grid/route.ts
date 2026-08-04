import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { generateBeardGrid, BEARD_STYLES } from "@/lib/v2/gemini";
import { hasPurchasedModule } from "@/lib/v2/requirePurchase";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import { logV2 } from "@/lib/v2/log";
import { replaceImage } from "@/lib/v2/storageUpload";
import { MAX_GENERATIONS, gridGenerationsUsed, budgetExhaustedMessage } from "@/lib/v2/generationBudget";

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

  // Bundled into the Hairstyle Recommendations module rather than its own
  // paid tier — same grooming/styling category, no separate pricing plumbing
  // needed for a same-cost add-on.
  if (!(await hasPurchasedModule(supabase, auth.userId, sessionId, "hairstyle"))) {
    return NextResponse.json({ error: "Purchase the Hairstyle Recommendations module to generate beard previews" }, { status: 403 });
  }
  if (!(await checkRateLimit(supabase, auth.userId, "beard_grid", 8, 600))) {
    return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });
  }

  const used = await gridGenerationsUsed(supabase, "grooming_generations_v2", "kind", "beard", auth.userId, sessionId);
  if (used >= MAX_GENERATIONS) {
    return NextResponse.json({ error: budgetExhaustedMessage("beard"), remaining: 0 }, { status: 429 });
  }

  try {
    const { mimeType, base64 } = await generateBeardGrid(photoDataUrl, [...BEARD_STYLES]);
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `${auth.userId}/${sessionId}/beard-grid.${ext}`;

    const { error: upErr } = await replaceImage(supabase, path, Buffer.from(base64, "base64"), mimeType);
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(path, 60 * 60 * 24 * 7);

    const { error: dbErr } = await supabase.from("grooming_generations_v2")
      .insert({ session_id: sessionId, user_id: auth.userId, kind: "beard", storage_path: path, status: "complete" });
    if (dbErr) logV2.warn("v2_beard_grid_row_failed", { user_id: auth.userId, session_id: sessionId, message: dbErr.message });

    logV2.info("v2_beard_grid_generated", { user_id: auth.userId, session_id: sessionId });
    return NextResponse.json({ storagePath: path, styles: BEARD_STYLES, url: signed?.signedUrl, remaining: MAX_GENERATIONS - used - 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_beard_grid_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Could not generate your beard previews. Please try again." }, { status: 500 });
  }
}
