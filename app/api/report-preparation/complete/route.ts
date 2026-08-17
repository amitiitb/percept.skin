import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { logV2 } from "@/lib/v2/log";
import { sendReportReadyEmail } from "@/lib/v2/reportReadyEmail";

export const maxDuration = 60;

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await req.json() as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const supabase = adminClient();
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;

  try {
    const result = await sendReportReadyEmail(supabase, auth.userId, sessionId, siteOrigin);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    // Best-effort: lets the abandoned-report cron sweep skip sessions the
    // live flow already emailed. Not on the critical path - the email is
    // already sent and idempotency-keyed, so a failed update here just means
    // the cron re-checks (and no-ops, thanks to the same idempotency key) on
    // its next pass rather than causing a duplicate send.
    const { error: stampErr } = await supabase.from("report_purchases_v2")
      .update({ emailed_at: new Date().toISOString() }).eq("session_id", sessionId);
    if (stampErr) logV2.warn("v2_report_emailed_at_stamp_failed", { session_id: sessionId, message: stampErr.message });
    return NextResponse.json({ status: "sent" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logV2.error("v2_report_ready_email_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Your report is ready, but the email could not be sent yet" }, { status: 502 });
  }
}
