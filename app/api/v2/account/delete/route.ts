import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { logV2 } from "@/lib/v2/log";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Deletes: all photos_v2 storage objects, then the auth user (DB rows cascade
// via FK "on delete cascade" from auth.users -> user_profiles_v2/
// analysis_sessions_v2 -> analysis_photos_v2/analysis_metrics_v2).
export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = serviceClient();
  try {
    // Storage objects live under {userId}/{sessionId}/..., so list per session folder.
    const { data: sessions } = await supabase.from("analysis_sessions_v2").select("id").eq("user_id", auth.userId);
    for (const s of sessions ?? []) {
      const { data: sessionFiles } = await supabase.storage.from("photos_v2").list(`${auth.userId}/${s.id}`);
      if (sessionFiles?.length) {
        const paths = sessionFiles.map((f) => `${auth.userId}/${s.id}/${f.name}`);
        await supabase.storage.from("photos_v2").remove(paths);
      }
    }

    const { error: authErr } = await supabase.auth.admin.deleteUser(auth.userId);
    if (authErr) throw authErr;

    logV2.info("v2_account_deleted", { user_id: auth.userId });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_account_delete_failed", { user_id: auth.userId, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
