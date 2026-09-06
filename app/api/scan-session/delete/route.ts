import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { logV2 } from "@/lib/v2/log";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Lets a user delete any scan from their history — capturing, pending,
// analysing, failed, or a completed one with a paid report attached. Any
// purchase tied to it (report_purchases_v2.session_id) survives: that FK is
// "on delete set null" (migration 20260906000000), not cascade, specifically
// so deleting the scan never destroys the actual payment/order record.
export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json() as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const supabase = serviceClient();
  try {
    const { data: session, error: sessErr } = await supabase
      .from("analysis_sessions_v2").select("id, user_id, status").eq("id", sessionId).single();
    if (sessErr || !session) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    if (session.user_id !== auth.userId) return NextResponse.json({ error: "Not your scan" }, { status: 403 });

    // Storage objects live under {userId}/{sessionId}/... and aren't covered
    // by the DB's FK cascade (that only reaches Postgres rows, not the
    // separate storage schema) — clean them up explicitly, same as account
    // deletion does.
    const { data: files } = await supabase.storage.from("photos_v2").list(`${auth.userId}/${sessionId}`);
    if (files?.length) {
      await supabase.storage.from("photos_v2").remove(files.map((f) => `${auth.userId}/${sessionId}/${f.name}`));
    }

    const { error: delErr } = await supabase.from("analysis_sessions_v2").delete().eq("id", sessionId);
    if (delErr) throw delErr;

    logV2.info("v2_scan_session_deleted", { user_id: auth.userId, session_id: sessionId, status: session.status });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_scan_session_delete_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
