import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { logV2 } from "@/lib/v2/log";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const destination = await verifySupabaseUser(req);
  if (!destination) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { anonymousAccessToken, sessionId } = await req.json() as {
    anonymousAccessToken?: string;
    sessionId?: string;
  };
  if (!anonymousAccessToken || !sessionId) {
    return NextResponse.json({ error: "Missing scan handoff details" }, { status: 400 });
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: { user: anonymousUser } } = await verifier.auth.getUser(anonymousAccessToken);
  if (!anonymousUser?.is_anonymous || anonymousUser.id === destination.userId) {
    return NextResponse.json({ error: "Invalid anonymous scan" }, { status: 403 });
  }

  const { data: session } = await admin
    .from("analysis_sessions_v2")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", anonymousUser.id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const { data: files, error: listError } = await admin.storage.from("photos_v2").list(`${anonymousUser.id}/${sessionId}`);
  if (listError) return NextResponse.json({ error: "Could not prepare scan transfer" }, { status: 500 });

  const pathChanges: Array<{ oldPath: string; newPath: string }> = [];
  for (const file of files ?? []) {
    const oldPath = `${anonymousUser.id}/${sessionId}/${file.name}`;
    const newPath = `${destination.userId}/${sessionId}/${file.name}`;
    const { data: blob, error: downloadError } = await admin.storage.from("photos_v2").download(oldPath);
    if (downloadError || !blob) return NextResponse.json({ error: "Could not copy scan photos" }, { status: 500 });
    const { error: uploadError } = await admin.storage.from("photos_v2").upload(newPath, blob, { contentType: file.metadata?.mimetype ?? "image/jpeg", upsert: true });
    if (uploadError) return NextResponse.json({ error: "Could not save scan photos" }, { status: 500 });
    pathChanges.push({ oldPath, newPath });
  }

  for (const path of pathChanges) {
    const { error } = await admin
      .from("analysis_photos_v2")
      .update({ user_id: destination.userId, storage_path: path.newPath })
      .eq("session_id", sessionId)
      .eq("user_id", anonymousUser.id)
      .eq("storage_path", path.oldPath);
    if (error) return NextResponse.json({ error: "Could not attach scan photos" }, { status: 500 });
  }

  const { error: sessionError } = await admin
    .from("analysis_sessions_v2")
    .update({ user_id: destination.userId })
    .eq("id", sessionId)
    .eq("user_id", anonymousUser.id);
  if (sessionError) return NextResponse.json({ error: "Could not attach scan" }, { status: 500 });

  if (pathChanges.length) await admin.storage.from("photos_v2").remove(pathChanges.map((path) => path.oldPath));
  logV2.info("v2_anonymous_scan_claimed", { session_id: sessionId, user_id: destination.userId });
  return NextResponse.json({ ok: true });
}
