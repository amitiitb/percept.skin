import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logV2 } from "@/lib/v2/log";
import { sendReportReadyEmail } from "@/lib/v2/reportReadyEmail";

// Scheduled once daily by vercel.json (0 3 * * *). That cadence is a plan
// limit, not a design choice: Vercel Hobby rejects any cron running more
// than once per day and fails the whole deployment rather than downgrading
// the schedule. On Pro this should go back to */15 * * * * so a stranded
// report waits minutes rather than up to a day. This endpoint is idempotent
// and CRON_SECRET-gated, so pointing an external scheduler at it more often
// is an equally valid alternative to upgrading.
//
// Safety net for the one case a closed browser can actually break: the
// "report ready" email, which today only fires from the last step of the
// live prepare flow (app/prepare/[id]/page.tsx -> POST
// /api/report-preparation/complete). Everything else self-heals - the
// report page's panels (HairstylePanel, GroomingPanel, ColourAnalysisPanel,
// GlassesVirtualTryOn) already generate their previews on demand whenever
// the user next opens the report, regardless of whether the prepare flow
// ever finished. So this sweep does exactly one job: find purchases whose
// analysis is complete but were never emailed, and send that email -
// reusing the exact same sendReportReadyEmail() the live route calls,
// nothing duplicated or reimplemented.
export const maxDuration = 60;

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Purchases younger than this are left alone - the live flow is still the
// one finishing them under normal circumstances, and touching them early
// would race a browser tab that's still open and about to call the real
// completion route itself.
const GRACE_PERIOD_MINUTES = 15;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from("report_purchases_v2")
    .select("session_id, user_id, created_at, analysis_sessions_v2!inner(status)")
    .is("emailed_at", null)
    .lt("created_at", cutoff)
    .eq("analysis_sessions_v2.status", "complete")
    .limit(25);

  if (error) {
    logV2.error("v2_finish_abandoned_reports_query_failed", { message: error.message });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  let sent = 0;
  let failed = 0;

  for (const row of candidates ?? []) {
    try {
      const result = await sendReportReadyEmail(supabase, row.user_id, row.session_id, siteOrigin);
      if (!result.ok) {
        logV2.warn("v2_finish_abandoned_reports_skip", { session_id: row.session_id, reason: result.error });
        continue;
      }
      const { error: stampErr } = await supabase.from("report_purchases_v2")
        .update({ emailed_at: new Date().toISOString() }).eq("session_id", row.session_id);
      if (stampErr) logV2.warn("v2_report_emailed_at_stamp_failed", { session_id: row.session_id, message: stampErr.message });
      sent++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      logV2.error("v2_finish_abandoned_reports_send_failed", { session_id: row.session_id, message });
    }
  }

  logV2.info("v2_finish_abandoned_reports_swept", { checked: candidates?.length ?? 0, sent, failed });
  return NextResponse.json({ checked: candidates?.length ?? 0, sent, failed });
}
