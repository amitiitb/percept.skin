import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { generateFramePreview, GeminiGenerationError, GeminiEmptyResponseError, GeminiQuotaError } from "@/lib/v2/gemini";
import { logV2 } from "@/lib/v2/log";

function scopedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, frameName, framePrompt, photoDataUrl } = await req.json() as {
    sessionId?: string; frameName?: string; framePrompt?: string; photoDataUrl?: string;
  };
  if (!sessionId || !frameName || !framePrompt || !photoDataUrl) {
    return NextResponse.json({ error: "sessionId, frameName, framePrompt, and photoDataUrl are required" }, { status: 400 });
  }

  const token = req.headers.get("authorization")!.slice(7);
  const supabase = scopedClient(token);

  try {
    const { mimeType, base64 } = await generateFramePreview(photoDataUrl, framePrompt);
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `${auth.userId}/${sessionId}/frame-${frameName.toLowerCase().replace(/\s+/g, "-")}.${ext}`;

    const bytes = Buffer.from(base64, "base64");
    const { error: upErr } = await supabase.storage.from("photos_v2").upload(path, bytes, { contentType: mimeType, upsert: true });
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(path, 60 * 60 * 24 * 7);

    const { error: dbErr } = await supabase.from("frame_generations_v2").insert({
      session_id: sessionId, user_id: auth.userId, frame_name: frameName, storage_path: path, status: "complete",
    });
    if (dbErr) throw dbErr;

    logV2.info("v2_frame_generated", { session_id: sessionId, frame: frameName });
    return NextResponse.json({ imageUrl: signed?.signedUrl ?? null, storagePath: path });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isRefusal = err instanceof GeminiEmptyResponseError;
    const isQuota = err instanceof GeminiQuotaError;
    logV2.error("v2_frame_generate_failed", { session_id: sessionId, frame: frameName, message, refusal: isRefusal, quota: isQuota });

    try {
      await supabase.from("frame_generations_v2").insert({
        session_id: sessionId, user_id: auth.userId, frame_name: frameName, storage_path: "", status: "failed",
      });
    } catch { /* best-effort only */ }

    let userMessage = "Frame preview generation failed — try again shortly";
    if (isRefusal) userMessage = "Couldn't generate that frame preview — try a different style";
    if (isQuota) userMessage = "AI frame preview is temporarily unavailable — this feature needs billing enabled on the Gemini API project. Contact support.";

    return NextResponse.json(
      { error: userMessage },
      { status: isQuota ? 503 : err instanceof GeminiGenerationError ? 502 : 500 }
    );
  }
}
